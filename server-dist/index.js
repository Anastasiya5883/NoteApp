import cookieParser from 'cookie-parser';
import express from 'express';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createSessionToken, hashPassword, hashSessionToken, verifyPassword } from './auth.js';
import { isSupportedHistoryFileName } from './fileValidation.js';
import { createSession, createUser, createHistoryEntry, deleteExpiredSessions, deleteHistoryEntry, deleteSession, findHistoryEntry, findUserBySession, findUserByUsername, listHistoryEntries, } from './database.js';
const app = express();
const port = Number(process.env.PORT) || 3001;
const host = process.env.HOST || '127.0.0.1';
const sessionCookie = 'tz-assistant-session';
const sessionLifetimeMs = 7 * 24 * 60 * 60 * 1000;
app.disable('x-powered-by');
// JSON escaping can expand a valid 2 MB source text several times; the source
// text itself is still checked against the strict 2 MB UTF-8 limit below.
app.use(express.json({ limit: '16mb' }));
app.use(cookieParser());
function cookieOptions() {
    return {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: sessionLifetimeMs,
        path: '/',
    };
}
function openSession(res, userId) {
    deleteExpiredSessions();
    const token = createSessionToken();
    createSession(hashSessionToken(token), userId, Date.now() + sessionLifetimeMs);
    res.cookie(sessionCookie, token, cookieOptions());
}
function getCredentials(req) {
    const username = typeof req.body?.username === 'string' ? req.body.username.trim() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    if (!username || !password.trim())
        return null;
    return { username, password };
}
function requireAuth(req, res, next) {
    const token = req.cookies[sessionCookie];
    if (typeof token !== 'string') {
        res.status(401).json({ error: 'Не авторизован' });
        return;
    }
    const user = findUserBySession(hashSessionToken(token));
    if (!user) {
        res.clearCookie(sessionCookie, { path: '/' });
        res.status(401).json({ error: 'Не авторизован' });
        return;
    }
    req.authUser = user;
    next();
}
app.post('/api/auth/register', async (req, res, next) => {
    try {
        const credentials = getCredentials(req);
        if (!credentials) {
            res.status(400).json({ error: 'Введите логин и пароль' });
            return;
        }
        if (findUserByUsername(credentials.username)) {
            res.status(409).json({ error: 'Пользователь с таким логином уже существует' });
            return;
        }
        const { hash, salt } = await hashPassword(credentials.password);
        let user;
        try {
            user = createUser(credentials.username, hash, salt);
        }
        catch (error) {
            if (error instanceof Error && error.message.includes('users.username_normalized')) {
                res.status(409).json({ error: 'Пользователь с таким логином уже существует' });
                return;
            }
            throw error;
        }
        openSession(res, user.id);
        res.status(201).json({ user: { username: user.username } });
    }
    catch (error) {
        next(error);
    }
});
app.post('/api/auth/login', async (req, res, next) => {
    try {
        const credentials = getCredentials(req);
        if (!credentials) {
            res.status(400).json({ error: 'Введите логин и пароль' });
            return;
        }
        const user = findUserByUsername(credentials.username);
        const isValid = user
            ? await verifyPassword(credentials.password, user.password_salt, user.password_hash)
            : false;
        if (!user || !isValid) {
            res.status(401).json({ error: 'Неверный логин или пароль' });
            return;
        }
        openSession(res, user.id);
        res.json({ user: { username: user.username } });
    }
    catch (error) {
        next(error);
    }
});
app.get('/api/auth/me', requireAuth, (req, res) => {
    res.json({ user: { username: req.authUser.username } });
});
app.post('/api/auth/logout', (req, res) => {
    const token = req.cookies[sessionCookie];
    if (typeof token === 'string')
        deleteSession(hashSessionToken(token));
    res.clearCookie(sessionCookie, { path: '/' });
    res.status(204).end();
});
function parseHistoryId(value) {
    if (typeof value !== 'string')
        return null;
    const id = Number(value);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
}
function isAnalysisResult(value) {
    if (!value || typeof value !== 'object')
        return false;
    const result = value;
    return Number.isFinite(result.words)
        && Array.isArray(result.entities)
        && Array.isArray(result.attributes)
        && Array.isArray(result.sections)
        && Array.isArray(result.gaps)
        && Array.isArray(result.recommendations)
        && (result.mode === undefined || result.mode === 'attributes' || result.mode === 'contradictions')
        && (result.contradictions === undefined || Array.isArray(result.contradictions));
}
const toHistorySummary = (entry) => {
    let metadata = {};
    try {
        metadata = JSON.parse(entry.analysis_json);
    }
    catch {
        // Existing counters remain usable even if a legacy detail is malformed.
    }
    return {
        id: entry.id,
        fileName: entry.file_name,
        createdAt: entry.created_at,
        mode: metadata.mode === 'contradictions' ? 'contradictions' : 'attributes',
        stats: {
            words: entry.word_count,
            entities: entry.entity_count,
            attributes: entry.attribute_count,
            sections: entry.section_count,
            gaps: entry.gap_count,
            contradictions: Array.isArray(metadata.contradictions) ? metadata.contradictions.length : 0,
        },
    };
};
app.post('/api/history', requireAuth, (req, res) => {
    const fileName = typeof req.body?.fileName === 'string' ? req.body.fileName.trim() : '';
    const sourceText = typeof req.body?.sourceText === 'string' ? req.body.sourceText : '';
    const result = req.body?.result;
    if (!fileName || fileName.length > 255 || !sourceText.trim() || !isAnalysisResult(result)) {
        res.status(400).json({ error: 'Некорректные данные файла или результата анализа' });
        return;
    }
    if (!isSupportedHistoryFileName(fileName)) {
        res.status(400).json({ error: 'Поддерживаются файлы .txt, .md, .markdown, .pdf и .docx' });
        return;
    }
    if (Buffer.byteLength(sourceText, 'utf8') > 2 * 1024 * 1024) {
        res.status(413).json({ error: 'Размер файла не должен превышать 2 МБ' });
        return;
    }
    const entry = createHistoryEntry(req.authUser.id, fileName, sourceText, JSON.stringify(result), {
        words: result.words,
        entities: result.entities.length,
        attributes: result.attributes.length,
        sections: result.sections.length,
        gaps: result.gaps.length,
    });
    res.status(201).json({ entry: toHistorySummary(entry) });
});
app.get('/api/history', requireAuth, (req, res) => {
    res.json({ entries: listHistoryEntries(req.authUser.id).map(toHistorySummary) });
});
app.get('/api/history/:id', requireAuth, (req, res) => {
    const id = parseHistoryId(req.params.id);
    const entry = id === null ? undefined : findHistoryEntry(req.authUser.id, id);
    if (!entry) {
        res.status(404).json({ error: 'Запись не найдена' });
        return;
    }
    res.json({
        entry: {
            ...toHistorySummary(entry),
            sourceText: entry.source_text,
            result: JSON.parse(entry.analysis_json),
        },
    });
});
app.delete('/api/history/:id', requireAuth, (req, res) => {
    const id = parseHistoryId(req.params.id);
    if (id === null || !deleteHistoryEntry(req.authUser.id, id)) {
        res.status(404).json({ error: 'Запись не найдена' });
        return;
    }
    res.status(204).end();
});
app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Маршрут не найден' });
});
const clientDist = resolve('dist');
if (existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.get('/{*splat}', (_req, res) => res.sendFile(resolve(clientDist, 'index.html')));
}
app.use((error, _req, res, _next) => {
    console.error(error);
    if (typeof error === 'object' && error && 'type' in error && error.type === 'entity.too.large') {
        res.status(413).json({ error: 'Объём данных анализа превышает допустимый лимит' });
        return;
    }
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
});
app.listen(port, host, () => {
    console.log(`API доступен на http://${host}:${port}`);
});
