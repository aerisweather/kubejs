#!/usr/bin/env node
const ReplicationController = require('../lib/Kubernetes/ReplicationController');
const Cli = require('admiral-cli');

const cli = new Cli()
	.option({
		name: 'namespace',
		description: 'k8s namespace in which to redistribute pods',
		shortFlag: '-n',
		longFlag: '--namespace',
		required: true,
		length: 1
	})

cli.parse();

if (!cli.params.namespace) {
	throw new Error('Missing required namespace param');
}

ReplicationController.getAll(cli.params.namespace)
	.then(rcs => {
		return Promise.all(
			rcs.map(rc => rc.scale(1))
		)
	})
	.then(() => {
		console.log('done');
		process.exit(0);
	}, (err) => {
		console.error(err, err.stack);
		process.exit(1);
	})