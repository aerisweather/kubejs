const http = require('http');

/**
 * Promisified http.get, defaults to JSON results
 *
 * @param {string} url - The full URL to query against, include protocol
 * @param {boolean} [parseAsJson=true]
 * @returns {Promise}
 */
function httpGetPromise(url, parseAsJson) {
	parseAsJson = (parseAsJson === undefined) ? true : parseAsJson;
	return new Promise((resolve, reject) => {
		http.get(url, (res) => {
			var body = '';

			res.on('data', (chunk) => body += chunk);

			res.on('end', () => {
				if(res.statusCode >= 200 && res.statusCode < 300) {
					if(parseAsJson) {
						try {
							return resolve(JSON.parse(body));
						}
						catch (e) {
							return reject(e);
						}
					}
					return resolve(body);
				}
				var err = new Error(`Request error, got status code: ${res.statusCode}`);
				err.statusCode = res.statusCode;
				if(parseAsJson) {
					try {
						err.body = JSON.parse(body);
					}
					catch (e) {
						err.body = body;
					}
				}
				else {
					err.body = body;
				}
				return reject(err);
			});
		})
		.on('error', (e) => reject(e));
	});
}

module.exports = httpGetPromise;