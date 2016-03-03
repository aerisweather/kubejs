const ReplicationController = require('./lib/Kubernetes/ReplicationController');

ReplicationController.getAll('amp-staging')
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