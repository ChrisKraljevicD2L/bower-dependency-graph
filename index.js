'use strict';

'use strict';

const fs = require('fs');
const Graph = require('graph-js');
const prettyjson = require('prettyjson');

function convertArrayOfObjectsToCSV(data) {
	let ctr;
	const keys = Object.keys(data[0]);
	const columnDelimiter = ',';
	const lineDelimiter = '\n';

	let result = '';

	result = `${result}${keys.join(columnDelimiter)}`;
	result = `${result}${lineDelimiter}`;

	data.forEach(item => {
		ctr = 0;
		keys.forEach(key => {
			if (ctr > 0) {
				result = `${result}${columnDelimiter}`;
			}

			result = `${result}${item[key]}`;
			ctr++;
		});
		result = `${result}${lineDelimiter}`;
	});

	return result;
}

function createEdgeId(depender, dependee, version) {
	return `${depender} - ${dependee}: ${version}`;
}

function errorOut(errorMessage) {
	console.error(errorMessage);
	process.exitCode = 1;
}

function bowerDeps(prettyJson, csv) {
	const bowerFile = fs.existsSync('bower.json') ? fs.readFileSync('bower.json') : null;

	if (!bowerFile) {
		errorOut('Empty or nonexistent bower.json!');
	}

	const dependencyGraph = new Graph();
	const bowerJson = JSON.parse(bowerFile);
	const packageName = bowerJSON.name;
	dependencyGraph.addNode(packageName, packageName);

	const hybridStatus = {};
	let isHybrid = bowerJson.variants && bowerJson.variants['1.x'] && bowerJson.variants['1.x'].dependencies && bowerJson.variants['1.x'].dependencies.polymer;

	hybridStatus[packageName] = isHybrid ? 'probs' : 'no';
	for (const dependencyName in bowerJson.dependencies) {
		if (!dependencyGraph.isNode(dependencyName)) {
			dependencyGraph.addNode(dependencyName, dependencyName);
			const dependencyVersion = bowerJson.dependencies[dependencyName];
			const edgeId = createEdgeId(packageName, dependencyName, dependencyVersion);
			if (!dependencyGraph.isEdge(edgeId)) {
				dependencyGraph.addEdge(packageName, dependencyName, edgeId, 0, dependencyVersion);
			}
		}
	}

	const bowerComponents = fs.existsSync('bower_components') ? fs.readdirSync('bower_components') : null;

	if (!bowerComponents) {
		console.error('Empty or nonexistent bower_components!');
		process.exitCode = 1;
	}
	bowerComponents.forEach(bowerComponent => {
		const bowerComponentFilePath = `bower_components/${bowerComponent}/bower.json`;
		const bowerComponentFile = fs.existsSync(bowerComponentFilePath)
			? fs.readFileSync(bowerComponentFilePath)
			: null;

		if (!bowerComponentFile) {
			console.error(`Empty or nonexistent ${bowerComponentFilePath}!`);
			process.exitCode = 1;
		}
		const bowerComponentJson = JSON.parse(bowerComponentFile);
		isHybrid = bowerComponentJson.variants && bowerComponentJson.variants['1.x'] && bowerComponentJson.variants['1.x'].dependencies && bowerComponentJson.variants['1.x'].dependencies.polymer;
		hybridStatus[bowerComponent] = isHybrid ? 'probs' : 'no';
		if (!dependencyGraph.isNode(bowerComponent)) {
			dependencyGraph.addNode(bowerComponent, bowerComponent);
		}
		for (const dependencyName in bowerComponentJson.dependencies) {
			if (!dependencyGraph.isNode(dependencyName)) {
				dependencyGraph.addNode(dependencyName, dependencyName);
			}
			const dependencyVersion = bowerComponentJson.dependencies[dependencyName];
			const edgeId = createEdgeId(bowerComponent, dependencyName, dependencyVersion);
			if (!dependencyGraph.isEdge(edgeId)) {
				dependencyGraph.addEdge(bowerComponent, dependencyName, edgeId, 0, dependencyVersion);
			}
		}
	});

	const jsonDependencies = {};
	const csvDependencies = {};

	dependencyGraph.getNodes().forEach(node => {
		const dependency = node.getId();
		csvDependencies[dependency] = {
			name: dependency,
			dependsOn: 'n/a',
			usedBy: 'n/a'
		};
		jsonDependencies[dependency] = {
			dependsOn: {},
			usedBy: {},
			hybrid: hybridStatus[dependency]
		}

	});

	dependencyGraph.getEdges().forEach(edge => {
		const depender = edge.getNodeStart().getId();
		const dependee = edge.getNodeEnd().getId();
		const version = edge.getLabel();
		jsonDependencies[depender].polymer = version;
		dependencies[depender].dependsOn[dependee] = version;
		jsonDependencies[dependee].usedBy[depender] = version;
		if (dependencies[depender].dependsOn === 'n/a') {
			csvDependencies[depender].dependsOn = dependee;
		} else {
			dependencies[depender].dependsOn = `${dependencies[depender].dependsOn} ${dependee}`;
		}

		if (dependencies[dependee].usedBy === 'n/a') {
			dependencies[dependee].usedBy = depender;
		} else {
			dependencies[dependee].usedBy = `${dependencies[dependee].usedBy} ${depender}`;
		}
	});

	if (csv) {
		fs.writeFileSync('bower-dependencies.csv', convertArrayOfObjectsToCSV(Object.values(csvDependencies)));
	}
	if (prettyJson) {
		fs.writeFileSync('bower-dependencies.txt', prettyjson.render(jsonDependencies, {noColor: true}));
	}
	fs.writeFileSync('bower-dependencies.json', JSON.stringify(jsonDependencies));
}

module.exports = bowerDeps;
