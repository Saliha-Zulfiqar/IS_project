/**
 * PhishGuard AI — content script for Gmail / Outlook.
 * Auto-extracts open email content and displays analysis overlay.
 */
(function () {
  if (typeof chrome === "undefined" || !chrome.runtime?.id) return;

  // Inject Analyze button into UI
  const btn = document.createElement('button');
  btn.id = 'phishguard-analyze-btn';
  btn.textContent = 'Analyze with PhishGuard';
  Object.assign(btn.style, {
    position: 'fixed',
    bottom: '24px',
    right: '24px',
    zIndex: 100000,
    padding: '12px 20px',
    fontFamily: '"Plus Jakarta Sans", "Segoe UI", system-ui, sans-serif',
    fontSize: '14px',
    fontWeight: '700',
    background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
    color: '#ffffff',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    borderRadius: '10px',
    boxShadow: '0 8px 24px rgba(59, 130, 246, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
    cursor: 'pointer',
    transition: 'all 0.2s ease-in-out',
  });
  document.body.appendChild(btn);

  // Add micro-animation hover effect to floating button
  btn.addEventListener('mouseenter', () => {
    btn.style.transform = 'translateY(-2px)';
    btn.style.boxShadow = '0 12px 28px rgba(59, 130, 246, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.3)';
  });
  btn.addEventListener('mouseleave', () => {
    btn.style.transform = 'translateY(0)';
    btn.style.boxShadow = '0 8px 24px rgba(59, 130, 246, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.2)';
  });

  btn.addEventListener('click', async () => {
    // Create overlay background
    const overlay = document.createElement('div');
    overlay.id = 'phishguard-overlay';
    Object.assign(overlay.style, {
      position: 'fixed',
      inset: '0',
      background: 'rgba(10, 10, 20, 0.75)',
      backdropFilter: 'blur(8px)',
      webkitBackdropFilter: 'blur(8px)',
      zIndex: 1000000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: '"Plus Jakarta Sans", "Segoe UI", system-ui, sans-serif',
    });

    // Create modal card
    const modal = document.createElement('div');
    modal.id = 'phishguard-modal';
    Object.assign(modal.style, {
      position: 'relative',
      background: 'linear-gradient(160deg, #1c2338 0%, #0d0d1a 100%)',
      border: '1px solid rgba(148, 163, 184, 0.16)',
      borderRadius: '16px',
      padding: '28px',
      maxWidth: '460px',
      width: '90%',
      color: '#f1f5f9',
      boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5), 0 0 40px rgba(59, 130, 246, 0.15)',
      boxSizing: 'border-box',
    });

    // Close button (X)
    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '&times;';
    Object.assign(closeBtn.style, {
      position: 'absolute',
      top: '16px',
      right: '18px',
      background: 'none',
      border: 'none',
      color: '#94a3b8',
      fontSize: '24px',
      fontWeight: '600',
      cursor: 'pointer',
      lineHeight: '1',
      padding: '4px',
      transition: 'color 0.2s',
    });
    closeBtn.addEventListener('mouseenter', () => closeBtn.style.color = '#f1f5f9');
    closeBtn.addEventListener('mouseleave', () => closeBtn.style.color = '#94a3b8');
    closeBtn.addEventListener('click', () => overlay.remove());

    const contentDiv = document.createElement('div');
    contentDiv.id = 'phishguard-modal-content';
    contentDiv.innerHTML = `
      <h3 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 800; color: #ffffff; display: flex; align-items: center; gap: 8px;">
        <span style="color: #3b82f6;">◈</span> PhishGuard AI Threat Analysis
      </h3>
      <p style="margin: 0; font-size: 14px; color: #94a3b8; line-height: 1.6;">Extracting email data & running AI threat analysis…</p>
    `;

    modal.appendChild(closeBtn);
    modal.appendChild(contentDiv);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });

    // Extract email data (basic heuristics)
    const emailData = (() => {
      let sender = '';
      let subject = '';
      let body = '';
      
      const senderEl = document.querySelector('[email]');
      if (senderEl) {
        sender = senderEl.getAttribute('email') || senderEl.textContent.trim();
      }
      
      const subjectEl = document.querySelector('h2[data-legacy-thread-id], h2[data-message-id], h2.hP');
      if (subjectEl) {
        subject = subjectEl.innerText.trim();
      }
      
      const bodyEl = document.querySelector('[role="textbox"][contenteditable=true]') || document.querySelector('.a3s');
      if (bodyEl) {
        body = bodyEl.innerText.trim();
      }
      
      return { sender, subject, body };
    })();

    // Critical validation: prevent false security sense if extraction fails
    if (!emailData.sender && !emailData.subject && !emailData.body) {
      contentDiv.innerHTML = `
        <h3 style="margin: 0 0 12px 0; font-size: 18px; font-weight: 800; color: #fda4af; display: flex; align-items: center; gap: 8px;">
          <span>⚠</span> Open Email Not Detected
        </h3>
        <p style="margin: 0 0 16px 0; font-size: 14px; color: #f1f5f9; line-height: 1.6;">
          PhishGuard could not extract any email content from the page.
        </p>
        <div style="background: rgba(244, 63, 94, 0.08); border-left: 3px solid #f43f5e; padding: 12px 14px; border-radius: 6px; font-size: 13px; color: #fecdd3; line-height: 1.5; margin-bottom: 16px;">
          <strong>How to analyze:</strong> Make sure you have opened a specific email thread inside Gmail or Outlook first, then click "Analyze with PhishGuard" again. Alternately, copy-paste the text manually into the PhishGuard extension popup.
        </div>
      `;
      return;
    }

    try {
      const response = await fetch('http://localhost:8000/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(emailData),
      });

      if (!response.ok) {
        throw new Error(`Server status ${response.status}`);
      }

      const data = await response.json();
      
      // Select badge styling
      const isPhish = data.classification === "PHISHING";
      const badgeColor = isPhish ? '#fda4af' : '#6ee7b7';
      const badgeBg = isPhish ? 'rgba(233, 69, 96, 0.12)' : 'rgba(16, 185, 129, 0.12)';
      const badgeBorder = isPhish ? 'rgba(233, 69, 96, 0.5)' : 'rgba(16, 185, 129, 0.45)';
      const riskColor = data.risk_score >= 75 ? '#fda4af' : (data.risk_score >= 45 ? '#fcd34d' : '#6ee7b7');

      contentDiv.innerHTML = `
        <h3 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 800; color: #ffffff; display: flex; align-items: center; gap: 8px;">
          <span style="color: #3b82f6;">◈</span> Analysis Result
        </h3>
        
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; background: rgba(0, 0, 0, 0.2); padding: 12px 16px; border-radius: 10px; border: 1px solid rgba(255, 255, 255, 0.05);">
          <div>
            <span style="display: inline-block; font-size: 11px; font-weight: 800; letter-spacing: 0.1em; color: ${badgeColor}; background: ${badgeBg}; border: 1px solid ${badgeBorder}; padding: 4px 10px; border-radius: 99px; text-transform: uppercase;">
              ${data.classification}
            </span>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 11px; color: #94a3b8; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 2px;">Risk Score</div>
            <div style="font-size: 22px; font-weight: 800; color: ${riskColor}; line-height: 1;">${data.risk_score}<span style="font-size: 13px; color: #64748b; font-weight: 500;">/100</span></div>
          </div>
        </div>

        <div style="margin-bottom: 16px;">
          <div style="font-size: 11px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 6px;">Key Signals & Reasons</div>
          <div style="background: rgba(13, 13, 26, 0.5); padding: 12px 14px; border-radius: 8px; border-left: 3px solid #3b82f6; font-size: 13px; color: #cbd5e1; line-height: 1.6;">
            ${data.reasons || 'No specific threat flags detected.'}
          </div>
        </div>

        <div>
          <div style="font-size: 11px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 6px;">Recommendation</div>
          <div style="background: rgba(245, 158, 11, 0.06); padding: 12px 14px; border-radius: 8px; border-left: 3px solid #f59e0b; font-size: 13px; color: #e2e8f0; line-height: 1.6;">
            <strong>${data.risk_level} Risk:</strong> ${data.recommendation || 'Proceed with normal precautions.'}
          </div>
        </div>
      `;
    } catch (err) {
      console.error('PhishGuard analysis error:', err);
      contentDiv.innerHTML = `
        <h3 style="margin: 0 0 12px 0; font-size: 18px; font-weight: 800; color: #f43f5e; display: flex; align-items: center; gap: 8px;">
          <span>⚠</span> Analysis Failed
        </h3>
        <p style="margin: 0 0 16px 0; font-size: 14px; color: #fecdd3; line-height: 1.6;">
          Could not communicate with the PhishGuard analysis server.
        </p>
        <div style="background: rgba(244, 63, 94, 0.08); padding: 12px 14px; border-radius: 6px; font-size: 13px; color: #cbd5e1; line-height: 1.5;">
          Make sure your local FastAPI backend is active and running on port 8000 (e.g., <code>python main.py</code> inside your backend directory).
        </div>
      `;
    }
  });

})();

