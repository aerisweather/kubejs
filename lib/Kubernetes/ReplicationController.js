"use strict";
const exec = require('../util/exec-promise');
const co = require('co');
const _ = require('lodash');

class ReplicationController {
	constructor(name, namespace) {
		this.name = name;
		this.namespace = namespace;
	}

	getJson() {
		return exec(`kubectl get rc ${this.name} --namespace ${this.namespace} -o json`)
			.then(out => JSON.parse(out));
	}

	scaleDelta(delta) {
		return this.getJson()
			.then(json => this.scale(json.spec.replicas + delta));
	}

	scaleMultiple(multiple) {
		return this.getJson()
			.then(json => this.scale(Math.ceil(json.spec.replicas * multiple)));
	}

	scale(replicas) {
		return exec(`kubectl scale --replicas=${replicas} rc ${this.name} --namespace ${this.namespace}`);
	}

	getPodsStatus() {
		return exec(`kubectl describe rc ${this.name} --namespace ${this.namespace}`)
			.then(descr => {
				const matches = descr
					.split('\n').filter(line => line.length)
					.filter(line => /^Pods Status:/.test(line))[0]
					.match(/([0-9]).*Running \/ ([0-9]).*Waiting \/ ([0-9]).*Succeeded \/ ([0-9]).*Failed/)

				if (!matches || !matches.length) {
					return Promise.reject(new Error('Unexpected rc description: ${descr}'));
				}

				return {
					running: parseInt(matches[1]),
					waiting: parseInt(matches[2]),
					succeeded: parseInt(matches[3]),
					failed: parseInt(matches[4])
				};
			});
	}

	areAllPodsRunning(desiredCount) {
		if(desiredCount !== undefined) {
			return this.getPodsStatus()
				.then(status => {
					return status.running === desiredCount;
				});
		}
		else {
			return this.getPodsStatus()
				.then(status => {
					return status.waiting === 0 && status.failed === 0;
				});
		}
	}

	waitForPods() {
		return this.getJson()
			.then((json) => new Promise(resolve => {
				const int = setInterval(() => {
					this.areAllPodsRunning(json.spec.replicas)
						.then(allRunning => {
							if (allRunning) {
								clearInterval(int);
								resolve();
							}
						})
				}, 2000);
			})
		);
	}

	reschedule(opts) {
		opts = _.defaults(opts || {}, {
			// how long to wait after scaling up before scaling down
			// (time of pod processes to initialize)
			graceTimeout: 1000 * 10
		});

		return this.scaleMultiple(2)
			.then(() => this.waitForPods())
			.then(() => new Promise(done => setTimeout(done, opts.graceTimeout)))
			.then(() => this.scaleMultiple(0.5));
	}
}

ReplicationController.getAll = (namespace) => {
	return exec(`kubectl get rc --namespace=${namespace}`)
		.then(out => out
			.split('\n').filter(line => line.length)
			.slice(1)
			.map(line => line.split(' ')[0])
			.map(rcName => new ReplicationController(rcName, namespace))
		);
};

module.exports = ReplicationController;