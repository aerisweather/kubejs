const childProcess = require('child_process');

/**
 * Promisified child_process.exec
 *
 * @param cmd
 * @param opts See child_process.exec node docs
 * @param {stream.Writable} opts.stdout If defined, child process stdout will be piped to it.
 * @param {stream.Writable} opts.stderr If defined, child process stderr will be piped to it.
 * @param {bool} opts.killOnExit Kill the child process when the parent process exits
 *
 * @returns {Promise<{ stdout: string, stderr: stderr }>}
 */
function execp(cmd, opts) {
	opts || (opts = {});
	return new Promise((resolve, reject) => {

		const child = childProcess.exec(cmd, opts,
			(err, stdout, stderr) => err ? reject(err) : resolve(stdout.toString('utf8')));

		if (opts.stdout) {
			child.stdout.pipe(opts.stdout);
		}
		if (opts.stderr) {
			child.stderr.pipe(opts.stderr);
		}

		// Kill child on exit
		const killChild = () => {
			child.kill();
		};
		process.on('exit', killChild);
		child.on('exit', () => process.removeListener('exit', killChild));
	});
}

module.exports = execp;
