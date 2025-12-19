// Email Signature HTML
export const EMAIL_SIGNATURE = `<div dir="ltr" class="gmail_signature" data-smartmail="gmail_signature"><div dir="ltr"><p style="color:rgb(34,34,34);line-height:1.2;margin-top:0pt;margin-bottom:0pt"><span style="color:rgb(68,68,68);background-color:transparent;vertical-align:baseline"><font face="times new roman, serif">Kind Regards,</font></span></p><p dir="ltr" style="color:rgb(34,34,34);line-height:1.2;margin-top:0pt;margin-bottom:0pt"><span style="color:rgb(68,68,68);background-color:transparent;font-weight:700;font-style:italic;vertical-align:baseline"><font face="times new roman, serif">Mehrdad</font></span></p><p dir="ltr" style="color:rgb(34,34,34);line-height:1.2;margin-top:0pt;margin-bottom:0pt"><span style="color:rgb(68,68,68);background-color:transparent;font-weight:700;font-style:italic;vertical-align:baseline"><font face="times new roman, serif"><br></font></span></p><p dir="ltr" style="color:rgb(34,34,34);line-height:1.2;margin-top:0pt;margin-bottom:0pt"><font face="times new roman, serif"><span style="color:rgb(68,68,68);background-color:transparent;font-weight:700;vertical-align:baseline">Director |&nbsp;</span><a href="https://mehrana.agency/" style="color:rgb(17,85,204)" target="_blank"><span style="background-color:transparent;vertical-align:baseline">Mehrana Marketing</span></a></font></p><p dir="ltr" style="color:rgb(34,34,34);line-height:1.2;margin-top:0pt;margin-bottom:0pt"><a href="http://www.linkedin.com/in/mehrdadsalehi" style="color:rgb(17,85,204);font-family:&quot;times new roman&quot;,serif" target="_blank"><span style="background-color:transparent;vertical-align:baseline">Linkedin</span></a><span style="font-family:&quot;times new roman&quot;,serif;background-color:transparent;vertical-align:baseline">&nbsp;|&nbsp;</span><a href="https://wa.me/14379926614" style="color:rgb(17,85,204);font-family:&quot;times new roman&quot;,serif" target="_blank"><span style="background-color:transparent;vertical-align:baseline">Whatsapp</span></a><span style="font-family:&quot;times new roman&quot;,serif">&nbsp;</span><span style="font-family:&quot;times new roman&quot;,serif;background-color:transparent;vertical-align:baseline">|&nbsp;</span><span style="font-family:&quot;times new roman&quot;,serif;background-color:transparent;color:rgb(17,85,204);vertical-align:baseline"><a href="tel:+14379926614" style="color:rgb(17,85,204)" target="_blank">+14379926614</a></span></p><p dir="ltr" style="color:rgb(34,34,34);line-height:1.2;margin-top:0pt;margin-bottom:0pt"><br></p><p dir="ltr" style="color:rgb(34,34,34);line-height:1.2;margin-top:0pt;margin-bottom:0pt"><img src="https://ci3.googleusercontent.com/meips/ADKq_NZ7YtRL9QWW6hNWD1Tq978eu3YoRYcRkCSci8tDwDWVI_VCKTDpGEoReUWlrrMjHdNOhcQKLSiGuX72yxssaU37M0vdqLA0-VdR-rA_sNsD5_9GbGDHtO04r4HHGxdRopo=s0-d-e1-ft#https://mehrana.agency/wp-content/uploads/2023/11/Mehrana-Logo-k-scaled.jpg" width="200" height="40"></p></div></div>`;

// Message Templates extracted from n8n workflows
export const MESSAGE_TEMPLATES = [
    // ======== SMS Templates ========
    {
        name: "Welcome SMS 2",
        type: "SMS",
        scenario: "fresh_nurture_2",
        subject: null,
        body: `Hi {{name}}! 

Mehrdad here again. Just checking if you got my email regarding the {{website}} audit? We're ready to start, just need that quick 15-min chat to align on goals. 
Check your inbox or book here: 
https://calendly.com/mehrdad-mehrana/15-minute-strategy-session

-Mehrdad from Mehrana`,
    },
    {
        name: "Welcome SMS 3",
        type: "SMS",
        scenario: "fresh_nurture_3",
        subject: null,
        body: `Hi {{name}}! 

I was taking an initial look at {{website}} today and noticed a couple of opportunities I'd love to share. Let's chat briefly so I can include them in your audit.

Book here: 
https://calendly.com/mehrdad-mehrana/15-minute-strategy-session

-Mehrdad from Mehrana`,
    },

    // ======== Email Templates ========
    {
        name: "Welcome Email 2",
        type: "EMAIL",
        scenario: "fresh_nurture_2",
        subject: "Quick check: {{website}} audit",
        body: `Hi {{name}},<br><br>I just wanted to follow up quickly to make sure you received my previous email regarding the audit request for {{website}}.<br><br>We are eager to get started on your customized plan, but we just need a quick 15-min chat to align on your specific goals (keywords, competitors, etc).<br><br>Please pick a time that works for you here:<br>👉 <a href="https://calendly.com/mehrdad-mehrana/15-minute-strategy-session">https://calendly.com/mehrdad-mehrana/15-minute-strategy-session</a><br><br><br>`,
    },
    {
        name: "Welcome Email 3",
        type: "EMAIL",
        scenario: "fresh_nurture_3",
        subject: "One question regarding {{website}}",
        body: `Hi {{name}},<br><br>I was taking a preliminary look at {{website}} today and noticed a couple of interesting opportunities for growth.<br><br>Before I finalize the audit strategy, could we have that quick 15-min chat? I want to make sure I'm focusing on the right areas that matter most to you.<br><br>You can book your slot here:<br>👉 <a href="https://calendly.com/mehrdad-mehrana/15-minute-strategy-session">https://calendly.com/mehrdad-mehrana/15-minute-strategy-session</a><br><br>Looking forward to it,<br><br><br>`,
    },
];

// Helper to populate templates with lead data
export function populateTemplate(template: string, lead: { name: string; website?: string; email?: string }) {
    return template
        .replace(/\{\{name\}\}/g, lead.name || '')
        .replace(/\{\{website\}\}/g, lead.website || '')
        .replace(/\{\{email\}\}/g, lead.email || '');
}
