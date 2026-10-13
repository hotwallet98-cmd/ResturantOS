import { Link } from 'react-router-dom'

const siteUrl = 'https://restaurantos.beigesong64.chatgpt.site'
const pluginRoot = 'C:/Users/Digitinia/.codex/plugins/cache/openai-curated-remote/sites/1.0.1'
const steps = [
  { title: 'Install the required tools', text: 'Install Node.js LTS and Git for Windows. Open a new terminal after installation so the commands are available.', code: 'node --version\nnpm.cmd --version\ngit --version' },
  { title: 'Open the project and install dependencies', text: 'Run these commands in PowerShell. npm ci installs the exact dependency versions recorded in package-lock.json.', code: 'cd C:\\Users\\Digitinia\\Downloads\\ResturantOS\nnpm.cmd ci' },
  { title: 'Check the app locally', text: 'Start the development server and open http://127.0.0.1:5173. This address works only on your computer. Stop the server with Ctrl+C when finished.', code: 'npm.cmd run dev' },
  { title: 'Build the production website', text: 'The build checks TypeScript and creates the production website in dist. Resolve any build errors before publishing.', code: 'npm.cmd run build' },
  { title: 'Reuse the existing Sites project', text: 'This app already has a hosting project. Keep its identity in .openai/hosting.json and reuse it for every update. Do not create another site.', code: '{\n  "project_id": "appgprj_6ace5ef1a1148191a84bbfd7bf6be0c3",\n  "static": { "directory": "dist" }\n}' },
  { title: 'Open the hosting source through Codex', text: 'Ask Codex to use the Sites plugin. It reads the current site access, requests a temporary repository write credential, and opens the source with the site-workflow helper. Supply the credential through the helper’s hidden stdin prompt; never put it in commands, files, or this public guide. Personal GitHub credentials are not needed for this Sites repository.', code: `node "${pluginRoot}/scripts/site-workflow.mjs" --project-id appgprj_6ace5ef1a1148191a84bbfd7bf6be0c3` },
  { title: 'Upload the exact source and package the build', text: 'After edits and a successful build, Codex runs the source helper again with the opening result, a fresh credential if necessary, and an absolute archive path outside the source checkout. The helper commits and pushes the source, packages dist, and returns the verified commit SHA and archive path. On Windows, set TAR_OPTIONS to avoid treating the drive letter as a remote host.', code: '$env:TAR_OPTIONS = "--force-local"\n# Codex supplies the workflow JSON through hidden stdin:\n# credential, source, commands: [], and archivePath' },
  { title: 'Save a version and publish it', text: 'Through the Sites plugin, Codex calls save_site_version with the exact project ID, returned commit SHA, and build archive. It then calls deploy_site_version with the returned saved-version ID. These are hosting tools inside Codex, not PowerShell commands. Preserve public access; do not change the audience during routine updates.' },
  { title: 'Confirm the deployment and share the URL', text: 'If deployment is pending, building, or publishing, Codex checks get_deployment_status until it succeeds or reports a failure. Share the returned live URL after success. Your computer does not need to stay on.', code: siteUrl },
  { title: 'Publish future changes', text: 'Local file changes do not update the live site automatically. Edit the app, check it, build it, and repeat the source upload, version save, and deployment steps. You can ask Codex: “Redeploy the latest RestaurantOS changes to the existing public site.”' },
]

export default function DeploymentGuide() {
  return (
    <main className="min-h-screen bg-slate-50 pb-16">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-5 py-5">
          <Link to="/" className="text-xl font-bold tracking-tight text-slate-900">Restaurant<span className="text-brand-600">OS</span></Link>
          <Link to="/login" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">Open app</Link>
        </div>
      </header>
      <div className="mx-auto max-w-4xl px-5 pt-12">
        <p className="text-sm font-semibold uppercase tracking-widest text-brand-600">Setup & publishing</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-900">Deployment guide</h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-slate-600">Follow these steps to run RestaurantOS locally and publish updates to its existing public website using Codex and Sites.</p>
        <div className="mt-7 rounded-xl border border-brand-200 bg-brand-50 p-5">
          <p className="font-semibold text-slate-900">Your public website</p>
          <a href={siteUrl} className="mt-2 block break-all text-brand-700 underline underline-offset-4">{siteUrl}</a>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">This deployment is a frontend demo with mock data and demo authentication. Shared persistent data and production accounts require a backend, database, and real authentication.</p>
        </div>
        <ol className="mt-10 space-y-5">
          {steps.map((step, index) => (
            <li key={step.title} className="rounded-xl border border-slate-200 bg-white p-5 sm:p-7">
              <div className="flex items-start gap-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-bold text-brand-700">{index + 1}</span>
                <div className="min-w-0 flex-1">
                  <h2 className="text-lg font-semibold text-slate-900">{step.title}</h2>
                  <p className="mt-2 text-sm leading-7 text-slate-600">{step.text}</p>
                  {step.code && <pre className="mt-4 overflow-x-auto rounded-lg bg-ink-900 p-4 text-xs leading-6 text-slate-100"><code>{step.code}</code></pre>}
                </div>
              </div>
            </li>
          ))}
        </ol>
        <section className="mt-8 rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold">Common setup issues</h2>
          <ul className="mt-3 list-disc space-y-3 pl-5 text-sm leading-6 text-slate-600">
            <li><strong>Node or Git is not recognized:</strong> reopen your terminal after installation and check that the tools are on PATH.</li>
            <li><strong>PowerShell blocks npm.ps1:</strong> use npm.cmd as shown above.</li>
            <li><strong>Temporary Git credential expired:</strong> ask Codex to request a new credential for the same Sites project.</li>
            <li><strong>The local address does not open on another device:</strong> share the public HTTPS address above.</li>
            <li><strong>A nested page does not open after refresh on another host:</strong> configure that host to serve index.html for app routes such as /login and /Deployment.</li>
          </ul>
        </section>
      </div>
    </main>
  )
}
