const pLimit = require('p-limit');
const pTimeout = require('p-timeout');

class Promises {

    static TYPE = {
        Series: Symbol("series"),
        Parallel: Symbol("parallel")
    }

    /**
     * 
     * @param {*} promises - array of Promises that you would for example send to Promise.all()
     * @param {*} type - specify how you would like this to run using options in TYPE enum
     * @param {*} opts {
     *        concurrency: Number, - Default 3. Specify the exact quality to you would like to limit parallelization.
     *        timeout: Millis, - set the timeout value if needed
     *        retries: Number, - sets number of times to retry on timeout
     *        onTimeout: function(attemptNumber) - function to call when a timeout occurs, is given attempt number param.
     * }
     * 
     * @returns
     */
    static async run(promises, opts = {}) {
        const timeout = opts?.timeout ?? null;
        const retries = opts?.timeoutRetries ?? 0;
        const onTimeout = opts?.onTimeout ?? null;

        // by default we limit it to 3 items if not specified to prevent an 
        // accidental issue of sending too much load to a async function / service
        const concurrency = opts?.concurrency ?? 3;

        const options = { timeout, retries, onTimeout };
        return await Promises._limit(promises, concurrency, options);
    }

    static async _limit(promises, limitNum, options) {
        const limit = pLimit(limitNum);

        // add timeout w/ retries if needed through a wrapper
        if (options.timeout !== null) {
            const { timeout, retries, onTimeout } = options;
            promises = Promises._timeoutWrapper(promises, timeout, retries, onTimeout);
        }

        const limited = promises.map(p => {
            // wrap each promise in a limit
            return limit(() => p);
        });

        return await Promise.allSettled(limited);
    }

    // This function wrapps each promise with the timeout specified
    // and then if needed adds the ability to retry
    static _timeoutWrapper(promises, timeout, retries, onTimeout) {

        // First wrap all promises in a timeout
        promises = promises.map(async p => {

            // attempt to 
            for (var i = 0; i < retries + 1; i++) {
                try {
                    const result = await pTimeout(p, timeout);
                    return result;
                } catch(error) {
                    const attempt = i + 1;

                    // Check if the error thrown is not related to a timeout
                    if (error.name !== 'TimeoutError') {
                        throw error;
                    }
                    // check if it's a Timeout error and we are out of retries
                    else if (error.name === 'TimeoutError' && attempt === (retries + 1) ) {
                        // if the user gave us a function to call on a timeout, call it now.
                        if (onTimeout !== null) {
                            onTimeout(attempt);
                        }
                        throw error;
                    }

                    // if the user gave us a function to call on a timeout, call it now.
                    if (onTimeout !== null) {
                        onTimeout(attempt);
                    }

                }
            }


        });

        return promises;
    }

}

module.exports = Promises;