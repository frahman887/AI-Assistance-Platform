/**
 * Helio-Sol embeddable chat widget.
 * Usage on host page:
 *   <script src="http://localhost:3001/widget.js" data-business="sunbright-solar"></script>
 *
 * Everything is namespaced under "hs-" to avoid colliding with host page CSS/JS.
 */
(function () {
  "use strict";

  // ---- Config -------------------------------------------------------------

  const scriptTag = document.currentScript;
  const businessSlug = scriptTag ? scriptTag.dataset.business : null;

  // Derive API base from the script's own src, so this keeps working
  // regardless of which host/port the backend is running on.
  const apiBase = scriptTag ? new URL(scriptTag.src).origin : "http://localhost:3001";

  if (!businessSlug) {
    console.error("Helio-Sol widget: missing data-business attribute on script tag.");
    return;
  }

  const LEAD_CAPTURE_AT_MESSAGE = 3;

  // ---- State ----------------------------------------------------------------

  let isOpen = false;
  let userMessageCount = 0;
  let leadCaptured = false;
  let pendingQuestion = null; // question waiting behind the lead form
  let leadFormActive = false;
  let hasUnread = false;

  // ---- Styles ---------------------------------------------------------------

  const style = document.createElement("style");
  style.textContent = `
    .hs-bubble {
      position: fixed; bottom: 20px; right: 20px; width: 60px; height: 60px;
      border-radius: 50%; background: #2b6cb0; color: #fff; border: none;
      cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.2); font-size: 26px;
      z-index: 999999; display: flex; align-items: center; justify-content: center;
      transition: transform 0.15s ease;
    }
    .hs-bubble:hover { transform: scale(1.06); }
    .hs-bubble-dot {
      position: absolute; top: 2px; right: 2px; width: 12px; height: 12px;
      background: #e53e3e; border-radius: 50%; border: 2px solid #fff; display: none;
    }
    .hs-bubble-dot.hs-show { display: block; }
    .hs-window {
      position: fixed; bottom: 92px; right: 20px; width: 320px; max-width: 90vw;
      height: 440px; max-height: 70vh; background: #fff; border-radius: 12px;
      box-shadow: 0 8px 30px rgba(0,0,0,0.25); display: flex; flex-direction: column;
      overflow: hidden; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      z-index: 999999; opacity: 0; transform: translateY(12px) scale(0.98);
      pointer-events: none; transition: opacity 0.16s ease, transform 0.16s ease;
    }
    .hs-window.hs-open { opacity: 1; transform: translateY(0) scale(1); pointer-events: auto; }
    .hs-header {
      background: #2b6cb0; color: #fff; padding: 12px 14px; font-size: 15px; font-weight: 600;
    }
    .hs-messages {
      flex: 1; overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 8px;
      background: #f7f9fc;
    }
    .hs-msg { max-width: 80%; padding: 8px 12px; border-radius: 12px; font-size: 13.5px; line-height: 1.4; }
    .hs-msg-user { align-self: flex-end; background: #2b6cb0; color: #fff; border-bottom-right-radius: 2px; }
    .hs-msg-bot { align-self: flex-start; background: #e6eaf0; color: #1a202c; border-bottom-left-radius: 2px; }
    .hs-msg-error { align-self: flex-start; background: #fed7d7; color: #822727; }
    .hs-typing { align-self: flex-start; font-size: 13px; color: #718096; padding: 4px 12px; }
    .hs-input-row {
      display: flex; border-top: 1px solid #e2e8f0; padding: 8px; gap: 6px; background: #fff;
    }
    .hs-input {
      flex: 1; border: 1px solid #cbd5e0; border-radius: 8px; padding: 8px 10px; font-size: 13.5px;
      outline: none;
    }
    .hs-send {
      background: #2b6cb0; color: #fff; border: none; border-radius: 8px; padding: 8px 14px;
      font-size: 13.5px; cursor: pointer;
    }
    .hs-send:disabled { opacity: 0.5; cursor: not-allowed; }
    .hs-lead-form { align-self: stretch; background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px; }
    .hs-lead-form p { margin: 0 0 8px; font-size: 13px; color: #2d3748; }
    .hs-lead-form input {
      width: 100%; box-sizing: border-box; margin-bottom: 6px; padding: 7px 9px;
      border: 1px solid #cbd5e0; border-radius: 6px; font-size: 13px;
    }
    .hs-lead-actions { display: flex; gap: 6px; margin-top: 4px; }
    .hs-lead-submit {
      flex: 1; background: #2b6cb0; color: #fff; border: none; border-radius: 6px;
      padding: 7px; font-size: 13px; cursor: pointer;
    }
    .hs-lead-skip {
      background: none; border: none; color: #718096; font-size: 12px; cursor: pointer;
      text-decoration: underline;
    }
  `;
  document.head.appendChild(style);

  // ---- DOM construction -------------------------------------------------------

  const bubble = document.createElement("button");
  bubble.className = "hs-bubble";
  bubble.setAttribute("aria-label", "Open chat");
  bubble.textContent = "💬";

  const bubbleDot = document.createElement("span");
  bubbleDot.className = "hs-bubble-dot";
  bubble.appendChild(bubbleDot);

  const win = document.createElement("div");
  win.className = "hs-window";

  const header = document.createElement("div");
  header.className = "hs-header";
  header.textContent = "Chat with us";

  const messages = document.createElement("div");
  messages.className = "hs-messages";

  const inputRow = document.createElement("div");
  inputRow.className = "hs-input-row";

  const input = document.createElement("input");
  input.className = "hs-input";
  input.type = "text";
  input.placeholder = "Ask a question...";

  const sendBtn = document.createElement("button");
  sendBtn.className = "hs-send";
  sendBtn.textContent = "Send";

  inputRow.appendChild(input);
  inputRow.appendChild(sendBtn);
  win.appendChild(header);
  win.appendChild(messages);
  win.appendChild(inputRow);

  document.body.appendChild(bubble);
  document.body.appendChild(win);

  // ---- Helpers ----------------------------------------------------------------

  function appendMessage(text, kind) {
    const el = document.createElement("div");
    el.className = "hs-msg " + (kind === "user" ? "hs-msg-user" : kind === "error" ? "hs-msg-error" : "hs-msg-bot");
    el.textContent = text;
    messages.appendChild(el);
    messages.scrollTop = messages.scrollHeight;

    if (kind !== "user" && !isOpen) {
      hasUnread = true;
      bubbleDot.classList.add("hs-show");
    }
    return el;
  }

  function showTyping() {
    const el = document.createElement("div");
    el.className = "hs-typing";
    el.textContent = "Typing...";
    el.dataset.typing = "true";
    messages.appendChild(el);
    messages.scrollTop = messages.scrollHeight;
    return el;
  }

  function removeTyping(el) {
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }

  function setSending(isSending) {
    sendBtn.disabled = isSending;
    input.disabled = isSending;
  }

  async function askBackend(question) {
    const typingEl = showTyping();
    setSending(true);
    try {
      const res = await fetch(apiBase + "/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, businessSlug }),
      });
      const data = await res.json();
      removeTyping(typingEl);
      if (!res.ok) {
        appendMessage(data.error || "Something went wrong. Please try again.", "error");
        return;
      }
      appendMessage(data.answer, "bot");
    } catch (err) {
      removeTyping(typingEl);
      appendMessage("Couldn't reach the server. Please try again in a moment.", "error");
    } finally {
      setSending(false);
    }
  }

  function showLeadForm() {
    leadFormActive = true;
    setSending(true);

    const form = document.createElement("div");
    form.className = "hs-lead-form";

    const label = document.createElement("p");
    label.textContent = "Want a follow-up? Leave your info and we'll reach out.";

    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.placeholder = "Name";

    const emailInput = document.createElement("input");
    emailInput.type = "email";
    emailInput.placeholder = "Email";

    const actions = document.createElement("div");
    actions.className = "hs-lead-actions";

    const submitBtn = document.createElement("button");
    submitBtn.className = "hs-lead-submit";
    submitBtn.textContent = "Submit";

    const skipBtn = document.createElement("button");
    skipBtn.className = "hs-lead-skip";
    skipBtn.textContent = "Skip";

    actions.appendChild(submitBtn);
    actions.appendChild(skipBtn);
    form.appendChild(label);
    form.appendChild(nameInput);
    form.appendChild(emailInput);
    form.appendChild(actions);
    messages.appendChild(form);
    messages.scrollTop = messages.scrollHeight;

    function proceed() {
      form.remove();
      leadCaptured = true;
      leadFormActive = false;
      setSending(false);
      const q = pendingQuestion;
      pendingQuestion = null;
      if (q) askBackend(q);
    }

    submitBtn.addEventListener("click", async () => {
      const name = nameInput.value.trim();
      const email = emailInput.value.trim();
      if (!name && !email) {
        proceed(); // nothing entered, treat like skip
        return;
      }
      try {
        await fetch(apiBase + "/leads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ businessSlug, name, email }),
        });
      } catch (err) {
        // Non-fatal — don't block the conversation if lead save fails
        console.error("Helio-Sol widget: failed to save lead", err);
      }
      proceed();
    });

    skipBtn.addEventListener("click", proceed);
  }

  function handleSend() {
    const question = input.value.trim();
    if (!question) return;

    input.value = "";
    appendMessage(question, "user");
    userMessageCount += 1;

    if (userMessageCount === LEAD_CAPTURE_AT_MESSAGE && !leadCaptured) {
      pendingQuestion = question;
      showLeadForm();
      return;
    }

    askBackend(question);
  }

  // ---- Events -------------------------------------------------------------

  bubble.addEventListener("click", () => {
    isOpen = !isOpen;
    win.classList.toggle("hs-open", isOpen);
    if (isOpen) {
      hasUnread = false;
      bubbleDot.classList.remove("hs-show");
      if (messages.children.length === 0) {
        appendMessage("Hi! Ask me anything about our solar options.", "bot");
      }
      setTimeout(() => input.focus(), 180);
    }
  });

  sendBtn.addEventListener("click", handleSend);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleSend();
  });
})();