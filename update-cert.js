import hosts from '/root/scripts/hosts.json' with { type: 'json' }
import { execSync } from 'child_process';
import fs from 'fs';


if (!hosts) throw new Error("Hosts file is empty!")
const name = process.argv.slice(2)[0];
if (!name) throw new Error("No name specified!")
const allHosts = hosts.hosts;

for (let i = 0; i < allHosts.length; i++) {
	if (allHosts[i].name === name) {
		const host = allHosts[i];
		execSync(`sudo certbot --apache -d ${host.name}.is-dev.applications.ws`)
		host.certDate = Date.now();
		fs.writeFileSync("/root/scripts/hosts.json", JSON.stringify(hosts, null, " "))
		return;
	}
}
