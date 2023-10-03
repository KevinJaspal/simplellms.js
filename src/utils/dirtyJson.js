
const dJSON = require('dirty-json');

/**
 * Light wrapper around the Dirty JSON library, to handle
 * additional use cases as we find them
 */
class DirtyJson {

    static parse(jsonString) {

        // Attempt to parse json with dirty-json library.
        // Note! Could throw error
        const fJson = DirtyJson._parse(jsonString);
        return fJson;
    }

    static _parse(jsonString) {
        try {
            const fJson = dJSON.parse(jsonString);
            return fJson;

        } catch (error) {

            if (this._hasExtraEndingBracket(jsonString, error)) {
                // If we discover later we need to remove multiple brackets then 
                // the removal function will be more complicated. And it would be
                // better to make this a recursive function
                const newJSON = DirtyJson._removeExtraBracket(jsonString, error);

                // make a second attempt to parse the json, note: will throw any additional errors
                return dJSON.parse(newJSON);
            }

            // if it is any other error, continue to throw it
            throw error ;
        }

    }


    // check if the error thrown is specifically an extra ending parenthesis
    static _hasExtraEndingBracket(json, error) {
        const length = json.length;
        const errMessage = error?.message;
        if (errMessage.startsWith("Found } that I can't handle at line")) {
            // in the future if we needed to remove multiple brackets we would
            // need to check the specific char position mentioned in error
            if (errMessage.endsWith('0:' + length)) {
                return true;
            }
        }

        return false;
    }

    // remove extra paranthesis, can only identify and remove if one
    static _removeExtraBracket(json, error) {
        if (DirtyJson._hasExtraEndingBracket(json, error)) {
            const newJson = json.substr(0, json.length - 1);
            return newJson;
        }

        // this time failing open by returning original json
        return json;
    }
}

module.exports = DirtyJson;