export class ConfigurationImportError extends Error {
    code;
    constructor(code, message, options) {
        super(message, options);
        this.name = 'ConfigurationImportError';
        this.code = code;
    }
}
