#!/usr/bin/env node
"use strict";
const ReplicationController = require('../lib/Kubernetes/ReplicationController');
const co = require('co');
const Cli = require('admiral-cli');
const _ = require('lodash');

const cli = new Cli()
	.option({
		name:        'namespace',
		description: 'k8s namespace in which to redistribute pods',
		shortFlag:   '-n',
		longFlag:    '--namespace',
		required:    true,
		length:      1
	});

cli.parse();

if (!cli.params.namespace) {
	throw new Error('missing namespace option');
}

function main() {
	return co(function* () {
		const rcs = yield ReplicationController.getAll(cli.params.namespace);

		// Scale up all nodes
		const rcGroups = _.chunk(rcs, 5);

		for (let rcGroup of rcGroups) {
			var rescheduleOps = rcGroup
				.filter(rc => rc.name !== 'postgres-db')
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


main()
	.then(() => {
		process.exit(0);
	}, (err) => {
		console.error(err.name, err.stack);
		process.exit(1);
	});
