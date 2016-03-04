function parseKubectlFields(output) {
	const rows =  output
		.split('\n')
		.filter(line => line.length)
		.map(line =>
			line.split(' ').filter(col => col.length)
		);

	const header = rows[0];
	const entries = rows.slice(1);

	return entries
		.map(row =>
			row.reduce((fields, col, i) => Object.assign(fields, {
				[header[i]]: col
			}), {})
		);
}

module.exports = parseKubectlFields;