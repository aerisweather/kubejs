#!/usr/bin/env node
const ReplicationController = require('../lib/Kubernetes/ReplicationController');
const co = require('co');
const Cli = require('admiral-cli');

const cli = new Cli()
	.option({
		name: 'namespace',
		description: 'k8s namespace in which to redistribute pods',
		shortFlag: '-n',
		longFlag: '--namespace',
		required: true,
		length: 1
	});

cli.parse();

if (!cli.params.namespace) {
	throw new Error('missing namespace option');
}

function main() {
	return co(function* () {
		const rcs = yield ReplicationController.getAll(cli.params.namespace);

		// Scale up all nodes
		yield rcs.map(rc => rc.reschedule());
	});
}


main()
	.then(() => {
		process.exit(0);
	}, (err) => {
		console.error(err.name, err.stack);
		process.exit(1);
	});
