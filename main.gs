/*
 * TurboFormulator – a "small" script for emulating a simple relational database
 * with Google Forms as the input and Google Sheets as the output.
 * Copyright (C) 2022 Michal Procházka.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 * 
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 * 
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 * 
 * This little script includes several outstanding features, such as:
 * - saving answers submitted from Google Forms into a Google Sheet, sorted
 *   into the correct sheets and columns (shocking, I know)
 * - if a table column requires an ID, it will automatically translate the answer
 *   into an ID pointing to another table (alright, this is a bit more interesting)
 * - if a table, which another table depends on (= if that another table contains
 *   a list containing values from this table), gets updated with a new value,
 *   it will automatically update the list in Google Forms for the other table
 *   with the new values (actually really neat)
 * - quite universal (see below for setup instructions)
 * 
 * Created for my ICT homework, but I guess it can also be useful elsewhere.
 * 
 * ### Setup instructions
 * 
 * To set this script up for yourself, create a new Form, open the Apps Script
 * editor and overwrite anything there is with this entire script.
 * 
 * Then, create a new Spreadsheet and copy its ID into the `spreadsheetID` constant
 * in this script's user configuration section (right below this wall of text).
 * The script will use this ID to save the answers to the spreadsheet when
 * the form is submitted.
 * 
 * For example, if the URL of your new Spreadsheet looks like this:
 * 
 * https://docs.google.com/spreadsheets/d/1abWjgQ-mJK2dE7-5SWdm9NXFbnpNDZBXyzATpt-Cwko/edit
 * 
 * then the ID is the middle bit:
 * 
 * 1abWjgQ-mJK2dE7-5SWdm9NXFbnpNDZBXyzATpt-Cwko
 * 
 * Just paste that into the `spreadsheetID` constant's contents, so that the line
 * of code looks like this:
 * 
 * const spreadsheetID = "1abWjgQ-mJK2dE7-5SWdm9NXFbnpNDZBXyzATpt-Cwko";
 * 
 * ### What is a relational databaase?
 * 
 * A relational database is a method of storing data into separate tables,
 * which in some way depend on each other.
 * 
 * As an example, let's say that you run a library. In the simplest form,
 * you need to track 3 different pieces of information: books, bookkeepers
 * and orders (you should probably also track the readers, but we're simplifying
 * here). So you create 3 tables: Books, Bookkeepers and Orders.
 * 
 * The Books table will contain the titles of the books, their authors' name
 * and their release dates. The Bookkeepers table will contain only their
 * names and surnames.
 * 
 * Where it gets interesting is the Orders table. The Orders table should track
 * the reader's name, the return date, the borrowed book and the bookkeeper.
 * However, you don't want to repeat the information about the book and bookkeeper
 * in this table. Instead, you simply want to point to an existing entry
 * in the Books and Bookkeepers table, and just giving the user a list of
 * possible existing options. (In Google Forms, this would be the Drop-down
 * list dialog).
 * 
 * This can be done, because each entry in each table has a unique key to
 * that particular table. If another table wants to reference it (i.e. if you
 * want to point to a book in the Books table from the Orders table), it
 * just stores its ID.
 * 
 * That's what this script does. It automatically populates the Google Forms
 * list dialog with the correct values from the other table, and when the Form
 * is submitted, it will only store the value's ID. Neat, huh?
 * 
 * NOTE: WHEN THE LIST DIALOG VALUES HAVE BEEN GENERATED, DO NOT EDIT THE VALUES!!!
 * They contain hidden Unicode characters, in which the value's ID is encoded for
 * faster lookup. (Hunting the value from the other table is way slower than just
 * decoding the ID from the value. Trust me, I tried that already).
 * 
 * ### Form setup
 * 
 * The Form and Spreadsheet have to be set up in a specific way. We shall start
 * with the Form. It must contain a radio button dialog in the beginning
 * of the Form, which will take the user to a specific section, where they
 * will fill out the answers for that particular section.
 * 
 * You may create as many sections as you wish, however, only one can be submitted
 * at one time. The flow chart of your Form should therefore look like this:
 * 
 * Start -> Radio button -+-> Section 1 -> Form submit
 *                        |
 *                        +-> Section 2 -> Form submit
 *                        |
 *                        +-> Section 3 -> Form submit
 * 
 * There must only be the intro screen with the radio button selection and only
 * a single section that the user has chosem by the radio button selection.
 * After that single section, the form must be submitted.
 * 
 * If your Form looks anywhere like this:
 * 
 * Start -> Radio button -+-> Section 1 -> Section 4 -> Form submit
 *                        |
 *                        +-> Section 2 -> Form submit
 *                        |
 *                        +-> Section 3 -> Form submit
 * 
 * or like this:
 * 
 * Start -> Radio button -+-> Section 1
 *                        |       ↓
 *                        +-> Section 2 -> Form submit
 *                        |
 *                        +-> Section 3 -> Form submit
 * 
 * or like this:
 * 
 * Start -> Section 1 -> Radio button -+-> Section 2 -> Form submit
 *                                     |
 *                                     +-> Section 3 -> Form submit
 *                                     |
 *                                     +-> Section 4 -> Form submit
 * 
 * or anything of that nature, then it is INVALID. DO NOT USE ANY OF THESE,
 * THE SCRIPT WILL SIMPLY NOT WORK CORRECTLY.
 * 
 * ### Section setup
 * 
 * In each section, you can put as many different elements as you want.
 * Here, however, comes the special sauce of this script: automatically
 * generating the list values based upon another table. To do that, just
 * add to the list's description the contents of the `formListDescStart`
 * constant as well as the table name you want to fetch values from.
 * After that, in brackets, include the values from the other table
 * which should be combined to create entries in the list (if there are
 * more, they should separated by commas).
 * 
 * For example, when the `formListDescStart` constant is "Values from: "
 * and the table you want to fetch values is called "Books", and you want
 * to give the user the book's name and its author, then the description
 * should be "Values from: Books (Title, Author's name)" (without quotes, of course).
 * The resulting list would look like this:
 * 
 * +--------------------------------------------------------+
 * | Choose                                               V |
 * +--------------------------------------------------------+
 * | Harry Potter and the Philosopher's Stone J. K. Rowling |
 * |                                                        |
 * | The Hobbit, or There and Back Again J. R. R. Tolkien   |
 * |                                                        |
 * | The Fellowship of the Ring J. R. R. Tolkien            |
 * +--------------------------------------------------------+
 * 
 * As the list will be automatically generated, you can put any options in there
 * (since Google Forms don't allow an empty list), this script will automatically
 * overwrite everything when a new entry in the other table appears.
 * 
 * To make sure the answers from each section goes into the right table,
 * each section's title has to of course be titled in a specific way as well.
 * Add the contents of the `formSectionNameStart` constant to the section's title
 * as well as the table name where you want to store this section's answers.
 * 
 * For example, when the `formSectionNameStart` constant is "New entry in: "
 * and the table you want to fetch values is called "Bookkeepers", then the
 * description should be "New entry in: Bookkeepers" (again, without quotes).
 * 
 * The `formSectionNameStart` as well as `formListDescStart` constants
 * can be changed to your liking in this script's user configuration section
 * (right below this wall of text).
 * 
 * That's it for the Form, now is the time to set up the Spreadsheet!
 * 
 * ### Spreadsheet setup
 * 
 * The Spreadsheet is actually quite simple. Firstly, for each of the Form's
 * sections, create a separate table (sheet). So, if your Form contains
 * the following sections:
 * 
 * - "New entry in: Books"
 * - "New entry in: Bookkeepers"
 * - "New entry in: Readers"
 * 
 * then the Spreadsheet must contain the following tables:
 * 
 * - "Books"
 * - "Bookkeepers"
 * - "Orders"
 * 
 * Each table has the first row dedicated for the column labels. Each column
 * label is dedicated to one Form element and it contains its exact title.
 * The first column is special, as it is the entry ID. DO NOT PUT ANYTHING
 * ELSE IN THERE!
 * 
 * So, let's say that the "Books" section in the Form contains the following:
 * 
 * - Short text answer, title "Title"
 * - Short text answer, title "Author's name"
 * - Date, title "Release date"
 * 
 * Then the "Books" table of the Spreadsheet should look like this:
 * 
 * +---------------+---------------+---------------+---------------+--------
 * | ID            | Title         | Author's name | Release date  |
 * +---------------+---------------+---------------+---------------+--------
 * |               |               |               |               |
 * 
 * A column with an unrelated label, which is not present in the Form, will
 * be ignored. This is so that you may add your own formulas to the table,
 * if you so desire.
 * 
 * One exception to this naming convention is for the automatically generated
 * lists (whose description contains the contents of the `formListDescStart`
 * constant), in which case you add "ID" after the column label, so if the
 * list's title is "Book", then the column label is "BookID".
 * 
 * Let's say that the "Orders" section in the Form contains the following:
 * 
 * - Short text answer, title "Reader name"
 * - Drop-down list, title "Book", description "Values from: Books (Name, Author)"
 * - Drop-down list, title "Bookkeeper", description "Values from: Bookkeepers (Name, Surname)"
 * - Date, title "Return date"
 * 
 * Then the "Orders" table of the Spreadsheet should look like this:
 * 
 * +--------------+--------------+--------------+--------------+--------------+--------
 * | ID           | Reader name  | BookID       | BookkeeperID | Return date  |
 * +--------------+--------------+--------------+--------------+--------------+--------
 * |              |              |              |              |              |
 * 
 * That's it for the Spreadsheet! Simple, right?
 * 
 * ### Finishing touches
 * 
 * Lastly, when everything is set up, run the installTrigger() function from the
 * Apps Script editor. This will install the script, making sure that it runs
 * anytime the Form is submitted.
 * 
 * And there you go! If you have set everything up correctly, by submitting
 * the Form, you should see the answers from a section in its corresponding
 * table. Note that it takes a bit of time before the data appears in
 * the spreadsheet, it can take up to 10 seconds.
 */

// USER CONFIGURATION STARTS HERE

const spreadsheetID = "19g9Kqd4RvRVT4x10HpjdBwdLSGmrHdV74IyhpxuAf20";

const formSectionNameStart = "Zápis do seznamu: ";
const formListDescStart = "Ze seznamu: ";

// USER CONFIGURATION ENDS HERE

// Lookup table containing invisible Unicode characters for decoding hidden IDs from the selected list response

const leetchars = [
  0x00AD, // 0 - Soft hyphen
  0x034F, // 1 - Combining grapheme joiner
  0x061C, // 2 - Arabic letter mark
  0x070F, // 3 - Syriac abbreviation mark
  0x17B4, // 4 - Khmer vowel inherent AQ
  0x17B5, // 5 - Khmer vowel inherent AA
  0x180E, // 6 - Mongolian vowel separator
  0x200B, // 7 - Zero width space
  0x200C, // 8 - Zero width non-joiner
  0x200D, // 9 - Zero width joiner
  0x200E, // A - Left-to-right mark
  0x200F, // B - Right-to-left mark
  0x2060, // C - Word joiner
  0x2061, // D - Function application
  0x2062, // E - Invisible times
  0x2063, // F - Invisible separator
];

function onFormSubmit(e) {
  if(e == null) {
    console.log("ERROR: The onFormSubmit() function expects to receive data from the Google Forms trigger handler in the function parameter. Quitting.");
    return;
  }

  const items = e.source.getItems();

  console.log("Scanning for section boundaries...");

  var sections = [];

  for(var i = 0; i < items.length; i++)
    if(items[i].getTitle().startsWith(formSectionNameStart))
      sections.push([ items[i].getTitle().substring(formSectionNameStart.length), i ]);

  sections.push([ null, items.length ]);

  console.log(sections);

  if(sections.length < 1) {
    console.log("ERROR: Found no sections. Quitting.");
    return;
  }

  console.log("Attempting to match the responses to a particular section...");

  const responses = e.response.getItemResponses();

  var responsesection = null;

  for(const r of responses) {
    const index = r.getItem().getIndex();

    console.log("Response: " + r.getItem().getTitle() + ", index " + index);

    for(var j = 0; j < sections.length - 1; j++) {
      if(index > sections[j][1] && index < sections[j + 1][1]) {
        responsesection = j;
        console.log("Success! This response belongs to section " + j + " (" + sections[j][0] + ")");
      }
    }

    if(responsesection == null) 
      console.log("Nope, trying again on the next one");
    else
      break;
  }

  if(responsesection == null) {
    console.log("ERROR: Could not map the response onto a section. Quitting.");
    return;
  }

  console.log("Loading the output spreadsheet and finding the table corresponding to this section...");

  var file = SpreadsheetApp.openById(spreadsheetID);
  var sheet = file.getSheetByName(sections[responsesection][0]);

  if(sheet == null) {
    console.log("ERROR: Could not find sheet " + sections[responsesection][0] + ". Quitting.");
    return;
  }

  console.log("Generating the new table entry...");

  const newrow = sheet.getLastRow() + 1;
  
  const lastid = sheet.getRange(sheet.getLastRow(), 1).getValue();
  const id = (lastid == "ID") ? 1 : (lastid + 1);
  
  console.log("Generated a new ID: " + id);
  sheet.getRange(newrow, 1).setValue(id);

  console.log("Matching the response data to the table's columns...");

  var respcache = [];

  for(const r of responses)
    respcache.push([r.getItem().getTitle(), r.getResponse()]);

  console.log(respcache);

  for(var i = 2; i <= sheet.getLastColumn(); i++) {
    const name = sheet.getRange(1, i).getValue();

    console.log("Table column: " + name);

    for(const r of respcache) {
      if(r[0] == name) {
        console.log("Matched! " + r[1]);
        sheet.getRange(newrow, i).setValue(r[1]);
      } else if(r[0] + "ID" == name) {
        console.log("Matched! " + r[1] + " (but we have to find the ID...)");

        const split = r[1].split(" ");

        // Decode the ID using the super-leet turbo-haxxor decryption method

        var decodedid = 0;

        for(var x = 0; x < split[split.length - 1].length; x++) {
          decodedid <<= 4;

          const val = leetchars.indexOf(split[split.length - 1].charCodeAt(x));

          if(val >= 0 && val < 16) {
            decodedid |= val;
          } else {
            decodedid = "ERROR"
            break;
          }
        }

        console.log("Decoded ID: " + decodedid);

        sheet.getRange(newrow, i).setValue(decodedid);
      }
    }
  }

  console.log("Updating list boxes...");

  var listboxes = [];

  for(var i = 0; i < items.length; i++) if(items[i].getHelpText().startsWith(formListDescStart)) {
    var ptr = items[i].getHelpText().substring(formListDescStart.length).split(/[(),]/);

    ptr = ptr.filter((el) => { return el != "" });
    
    for(var x = 0; x < ptr.length; x++)
      ptr[x] = ptr[x].trim();

    console.log(ptr);

    if(ptr[0] != sections[responsesection][0]) {
      console.log("Not our data, skipping.");
      continue;
    }
    
    ptr[0] = "ID";

    console.log("This is our table, generating valid data");

    const columnnames = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    var ptrcolumnids = [];

    for(var x = 0; x < ptr.length; x++) {
      console.log("Looking for column " + ptr[x] + "...");

      ptrcolumnids[x] = null;

      for(var y = 0; y < columnnames.length; y++) {
        if(ptr[x] == columnnames[y]) {
          ptrcolumnids[x] = y;
          break;
        }
      }

      if(ptrcolumnids[x] != null) {
        console.log("Found at column " + ptrcolumnids[x] + "!");
      } else {
        console.log("ERROR: Could not find this column in the lookup table. Skipping this column.");
        break;
      }
    }

    if(ptrcolumnids.includes(null)) continue;

    console.log("Alright, we now have the columns, we just need to fetch the values now");

    const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();

    console.log(ptrcolumnids);

    var choices = [];

    for(const row of data) {
      result = "";

      // Generate string

      for(var x = 1; x < ptrcolumnids.length; x++) {
        result += row[ptrcolumnids[x]] + " ";
      }

      // Encode ID

      var idstr = "", idint = row[ptrcolumnids[0]] | 0; // OR'ing with 0 forces JS to cast to an integer (found that here: https://en.wikipedia.org/wiki/Asm.js)

      while(idint > 0) {
        idstr += String.fromCharCode(leetchars[idint & 0xF]);
        idint >>= 4;
      }

      // Embed it into the string, reverse it first though

      choices.push(result + idstr.split("").reverse().join(""));
    }

    choices.sort();

    console.log(choices);

    items[i].asListItem().setChoiceValues(choices);

    console.log("This Google Form item has been updated with new data.");
  }

  console.log("Alright, all is done. Hopefully I haven't messed up along the way. Hopefully.");
}

function installTrigger() {
  var form = FormApp.getActiveForm();
  if(ScriptApp.getScriptTriggers().length == 0) {
    ScriptApp.newTrigger('onFormSubmit')
      .forForm(form)
      .onFormSubmit()
      .create();

    console.log("Trigger installed!");
  } else {
    console.log("A trigger is already installed. Remove it and try again.");
  }
}
