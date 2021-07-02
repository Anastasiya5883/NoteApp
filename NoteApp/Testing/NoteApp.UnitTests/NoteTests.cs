using System;
using Newtonsoft.Json;
using NUnit.Framework;
using NUnit.Framework.Interfaces;

namespace NoteApp.UnitTests
{
    [TestFixture]
    public class NoteTests
    {
        [Test]
        public void Name_GoodName_ReturnsSameName()
        {
            //Setup
            var note = new Note();
            var sourceName = "We bought a dog.";
            var expectedName = sourceName;

            //Act
            note.Title = sourceName;
            var actualName = note.Title;

            //Assert
            NUnit.Framework.Assert.AreEqual(expectedName, actualName);
        }

        [Test]
        public void Text_GoodText_ReturnsSameText()
        {
            //Setup
            var note = new Note();
            var sourceName = "We bought a dog last week.";
            var expectedName = sourceName;

            //Act
            note.TextNote = sourceName;
            var actualName = note.TextNote;

            //Assert
            NUnit.Framework.Assert.AreEqual(expectedName, actualName);
        }

        [Test]
        public void Category_GoodCategory_ReturnsSameCategory()
        {
            //Setup
            var note = new Note();
            var sourceName = NotesCategory.Documents;
            var expectedName = sourceName;

            //Act
            note.NoteCategory = sourceName;
            var actualName = note.NoteCategory;

            //Assert
            NUnit.Framework.Assert.AreEqual(expectedName, actualName);
        }

        [Test]
        public void Create_GoodTimeCreate_ReturnsSameDate()
        {
            //Setup
            var note = new Note();
            var sourceName = new DateTime(2020,12,09);
            var expectedName = sourceName;

            //Act
            note.TimeCreate = sourceName;
            var actualName = note.TimeCreate;

            //Assert
            NUnit.Framework.Assert.AreEqual(expectedName, actualName);
        }

        [Test]
        public void Modify_GoodTimeModify_ReturnsSameDate()
        {
            //Setup
            var note = new Note();
            var sourceName = new DateTime(2020, 12, 09);
            var expectedName = sourceName;

            //Act
            note.TimeLastChange = sourceName;
            var actualName = note.TimeLastChange;

            //Assert
            NUnit.Framework.Assert.AreEqual(expectedName, actualName);
        }

        [Test]
        public void Name_BadName_ThrowsException()
        {
            //Setup
            var note = new Note();
            var sourceName = "We bought a dog last week and I am very happy. I'll call him Sparky and we'll walk outside every day.:)";

            //Assert
            NUnit.Framework.Assert.Throws<ArgumentException>
            (
                () =>
                {
                    //Act
                    note.Title = sourceName;
                }
            );
        }

        [Test]
        public void Name_NoneName_ReturnsBasicName()
        {
            //Setup
            var note = new Note();
            var sourceName = "";
            var expectedName = "Nameless";

            //Act
            note.Title = sourceName;
            var actualName = note.Title;

            //Assert
            NUnit.Framework.Assert.AreEqual(expectedName, actualName);
        }

        [Test]
        public void Clone_GoodClone_ReturnSameData()
        {
            //Setup
            var sourceCategory = NotesCategory.Work;
            var notesCategory = sourceCategory;
            var expectedNote = new Note
            {
                Title = "Работка",
                TextNote = "I love my work",
                NoteCategory = notesCategory,
                TimeCreate = new DateTime(2020, 12, 09),
                TimeLastChange = new DateTime(2020, 12, 09)
            };
            
            //Act
            var actualNote = expectedNote.Clone() as Note;
            var expected = JsonConvert.SerializeObject(expectedNote);
            var actual = JsonConvert.SerializeObject(actualNote);

            //Assert
            NUnit.Framework.Assert.AreEqual(expected, actual);
        }
    }
}