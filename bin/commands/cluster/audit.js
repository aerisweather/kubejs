const co = require('co');
const columnify = require('columnify');
const Cluster = require('../../../lib/Kubernetes/Cluster');
const _ = require('lodash');

function audit() {
	return co(function*() {
		const rcs = yield new Cluster().getAllResourceControllers({});

		const statsPromises = rcs.map(rc => co(function*() {
			const rcJson = yield rc.getJson();
			const containers = _.get(rcJson, 'spec.template.spec.containers');

			if (containers) {
				const problems = [];
				containers.map(containerSpec => {
					const resources = containerSpec.resources;
					if (resources.limits) {
						if (!resources.limits.cpu || resources.limits.cpu === "0") {
							problems.push("CPU Limit");
						}
						if (!resources.limits.memory || resources.limits.memory === "0") {
							problems.push("Memory Limit");
						}
					}
					else {
						problems.push("No limits set");
					}

					if (resources.requests) {
						if (!resources.requests.cpu || resources.requests.cpu === "0") {
							problems.push("CPU Request");
						}
						if (!resources.requests.memory || resources.requests.memory === "0") {
							problems.push("Memory Request");
						}
					}
					else {
						problems.push("No requests set");
					}
				});
				if(problems.length) {
					console.log(`RC ${rc.name} (${rc.namespace}) is missing: ${problems.join(', ')}`);
				}
			}
		}));

		return Promise.all(statsPromises);
	})
}
module.exports = audit;