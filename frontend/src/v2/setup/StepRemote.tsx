export function StepRemote() {
  return (
    <>
      <p>Want to check in or pause the internet when you are away from home? Tailscale makes that safe. You can do this later.</p>
      <ol style={{ paddingLeft: 20, lineHeight: 1.6 }}>
        <li>Install the free Tailscale app on the home box and on your phone.</li>
        <li>Sign in to both with the same account.</li>
        <li>On your phone, open the home box&apos;s Tailscale address in your browser.</li>
      </ol>
      <p>
        Full steps are in <a href="https://github.com/sgtslaughta/tskfrce/blob/main/docs/remote-access.md" target="_blank" rel="noreferrer">docs/remote-access.md</a>.
      </p>
    </>
  )
}
