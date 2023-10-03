const pLimit = require('p-limit');

class Promises {

    static TYPE = {
        Series: Symbol("series"),
        Parallel: Symbol("parallel"),
        Limit:  Symbol("limit"),
    }

    /**
     * 
     * @param {*} promises - array of Promises that you would for example send to Promise.all()
     * @param {*} type - specify how you would like this to run using options in TYPE enum
     * @param {*} limit - specify the exact quality to you would like to limit parallelization to
     * @returns
     */
    static async run(promises, type = Promises.TYPE.series, limit = null) {
        if (type === this.TYPE.Series) {
            return await Promise._series(promises);
        }

        if (type === this.TYPE.Parallel) {
            return await Promise.allSettled(promises);
        }

        if (type === this.TYPE.Limit) {

            if (limit === null) {
                // by default we limit it to 3 items if not specified
                // to prevent an accidental issue of sending too much
                // load to a async function / service
                limit = 3;
            }

            return await Promises._limit(promises, limit);
        }
    }

    static async _limit(promises, limitNum) {
        const limit = pLimit(limitNum);

        const limited = promises.map(p => {
            // wrap each promise in a limit
            return limit(() => p);
        });

        return await Promise.allSettled(limited);
    }

    static async _series(promises) {
        const results = [];

        for await (let promise of promises) {
            try {
                const result = await promise;
                results.push({ status: 'fulfilled', value: result });
            } catch (error) {
                results.push({ status: 'rejected', reason: error });
            }
        }

        return results;
    }

}

module.exports = Promises;