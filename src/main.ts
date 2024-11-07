const app = document.querySelector<HTMLDivElement>("#app")!;
const messageButton = document.createElement("button");
app.appendChild(messageButton);
messageButton.innerText = "message";
function handleClick(): void {
  alert("Hello");
}
messageButton.addEventListener("click", handleClick);
