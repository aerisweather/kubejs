#!/usr/bin/env node
"use strict";
const ReplicationController = require('../../../lib/Kubernetes/ReplicationController'),
	co = require('co'),
	_ = require('lodash');

function RedistributePods(namespace) {
	return co(function* () {
		const rcs = yield ReplicationController.getAll(namespace);

		// Scale up all nodes
		const rcGroups = _.chunk(rcs, 5);

		for (let rcGroup of rcGroups) {
			var rescheduleOps = rcGroup
				.filter(rc => rc.name !== 'postgres-db' && !rc.name.match(/proj\-importer/))
				.reduce((ops, rc) => {
					console.log(`Rescheduling ${rc.name}...`);
					ops.push(rc.reschedule());
					return ops;
				}, []);
			yield Promise.all(rescheduleOps);
		}
		console.log("Done.");
	});
}

module.exports = RedistributePods;