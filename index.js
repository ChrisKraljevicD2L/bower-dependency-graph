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
	process.exit(1);
}

function bowerDeps(prettyJson, csv, polymerInfo) {
	const bowerFile = fs.existsSync('bower.json') ? fs.readFileSync('bower.json') : null;

	if (!bowerFile) {
		errorOut('Empty or nonexistent bower.json!');
	}

	const bowerRCFile = fs.existsSync('.bowerrc') ? fs.readFileSync('.bowerrc') : null;
	const bowerRCJson = JSON.parse(bowerRCFile);

	const bowerComponentsPath = bowerRCJson.directory ? bowerRCJson.directory : 'bower_components';

	const dependencyGraph = new Graph();
	const bowerJson = JSON.parse(bowerFile);
	const packageName = bowerJson.name;
	dependencyGraph.addNode(packageName, packageName);

	const hybridStatus = {};
	let isHybrid = bowerJson
				&& bowerJson.variants
				&& bowerJson.variants['1.x']
				&& bowerJson.variants['1.x'].dependencies
				&& bowerJson.variants['1.x'].dependencies.polymer;

	let isPolymer = bowerJson
				&& bowerJson.dependencies
				&& bowerJson.dependencies.polymer;

	hybridStatus[packageName] = isPolymer ? (isHybrid ? 'yes' : 'no') : 'n/a';
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

	const bowerComponents = fs.existsSync(bowerComponentsPath) ? fs.readdirSync(bowerComponentsPath) : null;

	if (!bowerComponents) {
		errorOut('Empty or nonexistent bower_components!');
	}
	bowerComponents.forEach(bowerComponent => {
		const bowerComponentFilePath = `bower_components/${bowerComponent}/bower.json`;
		const bowerComponentFile = fs.existsSync(bowerComponentFilePath)
			? fs.readFileSync(bowerComponentFilePath)
			: null;

		if (bowerComponentFile) {
			const bowerComponentJson = JSON.parse(bowerComponentFile);
			isHybrid = bowerComponentJson
					&& bowerComponentJson.variants
					&& bowerComponentJson.variants['1.x']
					&& bowerComponentJson.variants['1.x'].dependencies
					&& bowerComponentJson.variants['1.x'].dependencies.polymer;
			isPolymer = bowerComponentJson
					&& bowerComponentJson.dependencies
					&& bowerComponentJson.dependencies.polymer;
			hybridStatus[bowerComponent] = isPolymer ? (isHybrid ? 'yes' : 'no') : 'n/a';
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
		}
	});

	const jsonDependencies = {};
	const csvDependencies = {};

	dependencyGraph.getNodes().forEach(node => {
		const dependency = node.getId();
		if (dependency !== 'polymer' || !polymerInfo) {
			csvDependencies[dependency] = {
				name: dependency,
				dependsOn: 'n/a',
				usedBy: 'n/a'
			};
			jsonDependencies[dependency] = {
				dependsOn: {},
				usedBy: {}
			};
			if (polymerInfo) {
				csvDependencies[dependency].polymer = 'no';
				csvDependencies[dependency].hybrid = hybridStatus[dependency];
				jsonDependencies[dependency].polymer = 'no';
				jsonDependencies[dependency].hybrid = hybridStatus[dependency];
			}
		}
	});

	dependencyGraph.getEdges().forEach(edge => {
		const depender = edge.getNodeStart().getId();
		const dependee = edge.getNodeEnd().getId();
		const version = edge.getLabel();
		if (depender !== 'polymer' || !polymerInfo) {
			if (dependee !== 'polymer' || !polymerInfo) {
				jsonDependencies[depender].dependsOn[dependee] = version;
				jsonDependencies[dependee].usedBy[depender] = version;
				if (csvDependencies[depender].dependsOn === 'n/a') {
					csvDependencies[depender].dependsOn = dependee;
				} else {
					csvDependencies[depender].dependsOn = `${csvDependencies[depender].dependsOn} ${dependee}`;
				}

				if (csvDependencies[dependee].usedBy === 'n/a') {
					csvDependencies[dependee].usedBy = depender;
				} else {
					csvDependencies[dependee].usedBy = `${csvDependencies[dependee].usedBy} ${depender}`;
				}
			} else {
				jsonDependencies[depender].polymer = version;
				csvDependencies[depender].polymer = version;
			}
		}
	});

	if (csv) {
		const csvDependenciesArray = Object.keys(csvDependencies).map(dependency => csvDependencies[dependency]);
		fs.writeFileSync('bower-dependencies.csv', convertArrayOfObjectsToCSV(csvDependenciesArray));
	}
	if (prettyJson) {
		fs.writeFileSync('bower-dependencies.txt', prettyjson.render(jsonDependencies, {noColor: true}));
	}
	fs.writeFileSync('bower-dependencies.json', JSON.stringify(jsonDependencies));
}

module.exports = bowerDeps;
