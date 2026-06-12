import PocketBase from "pocketbase";
import { execSync } from "child_process";
import fs from "fs";

const repo = process.argv[2];
const pb = new PocketBase("http://127.0.0.1:8090");
const PASSWORD = null;
if (!PASSWORD) throw new Error("Forgot to set db password.");

await pb
	.collection("_superusers")
	.authWithPassword("ljhaesler@protonmail.com", PASSWORD);

// basically this code will check if a repo already exists, and if it does, return the subdomain name and the port for that repo. If it doesn't, it will generate a new subdomain name and port for that repo, and then create a new Apache directive for that subdomain.
// a total of 1296 domains are possible with these animal-adjective combinations
// there shouldn't be any reason for them to run out

const hosts = await pb.collection("hosts").getFullList();
const hostData = await pb
	.collection("hosts")
	.getList(1, 1, { filter: `repo="${repo}"` });
const animalsData = await pb.collection("animals").getFullList();
const adjectivesData = await pb.collection("adjectives").getFullList();

let existingHost = null;
if (hostData.items.length === 1) existingHost = hostData.items[0];

const animals = animalsData.map((el) => el.animal);
const adjectives = adjectivesData.map((el) => el.adjective);
const usedNames = hosts.map((el) => el.name);

function generateName() {
	let exists = true;
	let name;
	while (exists) {
		// this find algorithm gets exponentially worse once half the possibe names are used
		// I would assume that there will never be more than 600 websites though...
		const adjI = Math.floor(Math.random() * adjectives.length);
		const animI = Math.floor(Math.random() * animals.length);

		name = `${adjectives[adjI]}${animals[animI]}`;
		exists = usedNames.includes(name);
	}

	return name;
}

function generatePort() {
	try {
		const usedPorts = getUsedPorts();

		for (let port = 1024; port <= 65535; port++) {
			if (!usedPorts.includes(port)) {
				return port;
			}
		}

		throw new Error("No available ports found in the specified range");
	} catch (err) {
		throw new Error(err);
	}
}

function getUsedPorts() {
	try {
		const output = execSync("ss -tuln", { encoding: "utf8" });
		const ports = [];

		output.split("\n").forEach((line) => {
			const match = line.match(/:(\d+)\s/);
			if (match) {
				ports.push(parseInt(match[1]));
			}
		});

		return ports;
	} catch (err) {
		throw new Error(err);
	}
}

function writeApacheDirective(name, port, repo) {
	const directive = `<VirtualHost *:80>
	    ServerName ${name}.is-dev.applications.ws

	    ProxyPreserveHost On
	    ProxyPass / http://127.0.0.1:${port}/
	    ProxyPassReverse / http://127.0.0.1:${port}/
    </VirtualHost>`;

	fs.writeFileSync(`/etc/apache2/sites-available/${repo}.conf`, directive);
}

async function writeToDb(name, port, repo) {
	await pb.collection("hosts").create({
		name,
		port,
		repo,
	});
}

try {
	let name;
	let port;
	let cert = "false";

	if (existingHost) {
		name = existingHost.name;
		port = existingHost.port;
	} else {
		name = generateName();
		port = generatePort();
		await writeToDb(name, port, repo);
		writeApacheDirective(name, port, repo);
		cert = "true";
	}

	if (process.env.GITHUB_OUTPUT) {
		const lines = [`domain-name=${name}`, `port=${port}`, `cert=${cert}`];
		fs.appendFileSync(process.env.GITHUB_OUTPUT, lines.join("\n") + "\n");
	} else {
		console.log(
			JSON.stringify({
				name,
				port,
				cert,
			}),
		);
	}
} catch (err) {
	console.error(err);
}
