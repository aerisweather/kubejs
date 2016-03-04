const _ = require('lodash');

function waitUntil(predicateFn, opts) {
	opts = _.defaults({}, opts || {}, {
		pollInterval: 2000
	});

	return new Promise(done => {
		const int = setInterval(() => {
			Promise.resolve(predicateFn())
				.then(isDone => {
					if (isDone) {
						clearInterval(int);
						done();
					}
				})
		}, opts.pollInterval);
	})
}

module.exports = waitUntil;