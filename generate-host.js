import hosts from '/root/scripts/hosts.json' with { type: 'json' }
import { execSync } from 'child_process';
import fs from 'fs';

// the script is intended to be called with a repo name 'node findhost.js REPO_NAME'
//
if (!hosts) throw new Error("Hosts file is empty!")
const repo = process.argv.slice(2)[0];
if (!repo) throw new Error("No repo specified!")
const usedNames = hosts.usedNames;
const usedRepos = hosts.usedRepos;
const allHosts = hosts.hosts;

// basically this code will check if a repo already exists, and if it does, return the subdomain name and the port for that repo. If it doesn't, it will generate a new subdomain name and port for that repo, and then create a new Apache directive for that subdomain.

// a total of 1296 domains are possible with these imports
// there shouldn't be any reason for them to run out
const animals = hosts.animals;
const adjectives = hosts.adjectives;


function generateName() {
	if (usedNames.length >= animals.length * adjectives.length) throw new Error("There are no more unique name combinations.")

	let exists = true;
	let name;
	while (exists) {
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

		throw new Error('No available ports found in the specified range');
	} catch (err) {
		throw new Error(err);
	}
}


function getUsedPorts() {
 try {
    const output = execSync('ss -tuln', { encoding: 'utf8' });
    const ports = [];

    output.split('\n').forEach(line => {
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
    </VirtualHost>`

	fs.writeFileSync(`/etc/apache2/sites-available/${repo}.conf`, directive);
}

function writeToJson(name, port, repo) {
	hosts.hosts.push({ name, port, repo });
	hosts.usedNames.push(name);
	hosts.usedRepos.push(repo);

	// writing this synchronously might cause latency issues if the JSON file gets very large (hundreds of hosts) but it's very unlikely that would happen, and this script would be run infrequently
	fs.writeFileSync("/root/scripts/hosts.json", JSON.stringify(hosts, null, " "))
}

try {

	let name;
	let port;

	if (usedRepos.includes(repo)) {
		const existingHost = allHosts.find((host) => host.repo === repo);
		name = existingHost.name;
		port = existingHost.port;
	} else {
		name = generateName();
		port = generatePort();
		writeToJson(name, port, repo)
		writeApacheDirective(name, port, repo)
	}

	if (process.env.GITHUB_OUTPUT) {
	  const lines = [
	    `domain-name=${name}`,
	    `port=${port}`,
	  ];
	  fs.appendFileSync(process.env.GITHUB_OUTPUT, lines.join('\n') + '\n');
	} else {
		console.log(JSON.stringify({
			name, port
		}));
	}


} catch (err) {
	console.error(err);
}
