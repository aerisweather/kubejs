const co = require('co');
const Node = require('../lib/Kubernetes/Node');


const nodeName = process.argv[2];
if (!nodeName) { throw new Error('Missing node name arguments'); }

function main() {
	const node = new Node(nodeName);

	return node.evacuate();
}


main()
	.then(() => {
		process.exit(0);
	}, (err) => {
		console.error(err.name, err.stack);
		process.exit(1);
	});


