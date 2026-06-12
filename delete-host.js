import PocketBase from "pocketbase";
import { execSync } from "child_process";

const repo = process.argv[2];
const pb = new PocketBase("http://127.0.0.1:8090");
const PASSWORD = null;
if (!PASSWORD) throw new Error("Forgot to set db password.");

await pb
	.collection("_superusers")
	.authWithPassword("ljhaesler@protonmail.com", PASSWORD);

const hostData = await pb
	.collection("hosts")
	.getList(1, 1, { filter: `repo="${repo}"` });

if (hostData.items.length === 1) {
	const existingHost = hostData.items[0];

	execSync(`sudo a2dissite ${existingHost.repo} ${existingHost.repo}-le-ssl`);
	execSync(
		`sudo rm /etc/apache2/sites-available/${existingHost.repo}.conf /etc/apache2/sites-available/${existingHost.repo}-le-ssl.conf`,
	);
	execSync(`docker stop ${existingHost.name}-container`);
	execSync(`docker rm ${existingHost.name}-container`);
	execSync(`docker rmi ${existingHost.name}-image`);
	execSync(
		`certbot delete --cert-name ${existingHost.name}.is-dev.applications.ws`,
		{ stdio: ["pipe", "inherit", "inherit"], input: "y\n" },
	);

	await pb.collection("hosts").delete(existingHost.id);

	execSync("apache2ctl restart");

	process.exit(0);
} else {
	throw new Error(`Repo name ${repo} was not found!`);
}
