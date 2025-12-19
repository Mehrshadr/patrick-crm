import { db } from '../lib/db'

const EMAIL_SIGNATURE = `<div dir="ltr" class="gmail_signature" data-smartmail="gmail_signature"><div dir="ltr"><p style="color:rgb(34,34,34);line-height:1.2;margin-top:0pt;margin-bottom:0pt"><span style="color:rgb(68,68,68);background-color:transparent;vertical-align:baseline"><font face="times new roman, serif">Kind Regards,</font></span></p><p dir="ltr" style="color:rgb(34,34,34);line-height:1.2;margin-top:0pt;margin-bottom:0pt"><span style="color:rgb(68,68,68);background-color:transparent;font-weight:700;font-style:italic;vertical-align:baseline"><font face="times new roman, serif">Mehrdad</font></span></p><p dir="ltr" style="color:rgb(34,34,34);line-height:1.2;margin-top:0pt;margin-bottom:0pt"><span style="color:rgb(68,68,68);background-color:transparent;font-weight:700;font-style:italic;vertical-align:baseline"><font face="times new roman, serif"><br></font></span></p><p dir="ltr" style="color:rgb(34,34,34);line-height:1.2;margin-top:0pt;margin-bottom:0pt"><font face="times new roman, serif"><span style="color:rgb(68,68,68);background-color:transparent;font-weight:700;vertical-align:baseline">Director |&nbsp;</span><a href="https://mehrana.agency/" style="color:rgb(17,85,204)" target="_blank"><span style="background-color:transparent;vertical-align:baseline">Mehrana Marketing</span></a></font></p><p dir="ltr" style="color:rgb(34,34,34);line-height:1.2;margin-top:0pt;margin-bottom:0pt"><a href="http://www.linkedin.com/in/mehrdadsalehi" style="color:rgb(17,85,204);font-family:times new roman,serif" target="_blank"><span style="background-color:transparent;vertical-align:baseline">Linkedin</span></a><span style="font-family:times new roman,serif;background-color:transparent;vertical-align:baseline">&nbsp;|&nbsp;</span><a href="https://wa.me/14379926614" style="color:rgb(17,85,204);font-family:times new roman,serif" target="_blank"><span style="background-color:transparent;vertical-align:baseline">Whatsapp</span></a><span style="font-family:times new roman,serif">&nbsp;</span><span style="font-family:times new roman,serif;background-color:transparent;vertical-align:baseline">|&nbsp;</span><span style="font-family:times new roman,serif;background-color:transparent;color:rgb(17,85,204);vertical-align:baseline"><a href="tel:+14379926614" style="color:rgb(17,85,204)" target="_blank">+14379926614</a></span></p><p dir="ltr" style="color:rgb(34,34,34);line-height:1.2;margin-top:0pt;margin-bottom:0pt"><br></p><p dir="ltr" style="color:rgb(34,34,34);line-height:1.2;margin-top:0pt;margin-bottom:0pt"><img src="https://mehrana.agency/wp-content/uploads/2023/11/Mehrana-Logo-k-scaled.jpg" width="200" height="40"></p></div></div>`

async function seedAutomation() {
    console.log('🌱 Seeding automation templates and rules...')

    // ===================
    // MESSAGE TEMPLATES
    // ===================

    // Welcome 1 Email
    const welcome1Email = await db.messageTemplate.upsert({
        where: { id: 1 },
        update: {},
        create: {
            name: 'Welcome Email 1',
            type: 'EMAIL',
            scenario: 'welcome_1',
            subject: 'Website Audit Request',
            body: `Hello {name},<br><br>Thank you for requesting website audit for {website}. To prepare the audit, we need to better understand your goals — for example, the keywords you would like people to find you with and who your main competitors are.<br><br>To move forward, Please choose a 15-minute slot here so we can chat:<br>👉 <a href="https://calendly.com/mehrdad-mehrana/15-minute-strategy-session">https://calendly.com/mehrdad-mehrana/15-minute-strategy-session</a><br><br>`,
            signature: EMAIL_SIGNATURE,
            isActive: true,
        }
    })

    // Welcome 1 SMS
    const welcome1Sms = await db.messageTemplate.upsert({
        where: { id: 2 },
        update: {},
        create: {
            name: 'Welcome SMS 1',
            type: 'SMS',
            scenario: 'welcome_1',
            body: `Hi {name}! 
Thanks for requesting an audit for {website}. To tailor it, I just need a few details (goals/keywords/competitors). Please book a quick 15-min chat: 
https://calendly.com/mehrdad-mehrana/15-minute-strategy-session

-Mehrdad from Mehrana`,
            isActive: true,
        }
    })

    // Welcome 2 Email
    const welcome2Email = await db.messageTemplate.upsert({
        where: { id: 3 },
        update: {},
        create: {
            name: 'Welcome Email 2',
            type: 'EMAIL',
            scenario: 'welcome_2',
            subject: 'Quick check: {website} audit',
            body: `Hi {name},<br><br>I just wanted to follow up quickly to make sure you received my previous email regarding the audit request for {website}.<br><br>We are eager to get started on your customized plan, but we just need a quick 15-min chat to align on your specific goals (keywords, competitors, etc).<br><br>Please pick a time that works for you here:<br>👉 <a href="https://calendly.com/mehrdad-mehrana/15-minute-strategy-session">https://calendly.com/mehrdad-mehrana/15-minute-strategy-session</a><br><br>`,
            signature: EMAIL_SIGNATURE,
            isActive: true,
        }
    })

    // Welcome 2 SMS
    const welcome2Sms = await db.messageTemplate.upsert({
        where: { id: 4 },
        update: {},
        create: {
            name: 'Welcome SMS 2',
            type: 'SMS',
            scenario: 'welcome_2',
            body: `Hi {name}! 

Mehrdad here again. Just checking if you got my email regarding the {website} audit? We're ready to start, just need that quick 15-min chat to align on goals. 
Check your inbox or book here: 
https://calendly.com/mehrdad-mehrana/15-minute-strategy-session

-Mehrdad from Mehrana`,
            isActive: true,
        }
    })

    // Welcome 3 Email
    const welcome3Email = await db.messageTemplate.upsert({
        where: { id: 5 },
        update: {},
        create: {
            name: 'Welcome Email 3',
            type: 'EMAIL',
            scenario: 'welcome_3',
            subject: 'One question regarding {website}',
            body: `Hi {name},<br><br>I was taking a preliminary look at {website} today and noticed a couple of interesting opportunities for growth.<br><br>Before I finalize the audit strategy, could we have that quick 15-min chat? I want to make sure I'm focusing on the right areas that matter most to you.<br><br>You can book your slot here:<br>👉 <a href="https://calendly.com/mehrdad-mehrana/15-minute-strategy-session">https://calendly.com/mehrdad-mehrana/15-minute-strategy-session</a><br><br>Looking forward to it,<br><br>`,
            signature: EMAIL_SIGNATURE,
            isActive: true,
        }
    })

    // Welcome 3 SMS
    const welcome3Sms = await db.messageTemplate.upsert({
        where: { id: 6 },
        update: {},
        create: {
            name: 'Welcome SMS 3',
            type: 'SMS',
            scenario: 'welcome_3',
            body: `Hi {name}! 

I was taking an initial look at {website} today and noticed a couple of opportunities I'd love to share. Let's chat briefly so I can include them in your audit.

Book here: 
https://calendly.com/mehrdad-mehrana/15-minute-strategy-session

-Mehrdad from Mehrana`,
            isActive: true,
        }
    })

    console.log('✅ Templates created')

    // ===================
    // AUTOMATION RULES
    // ===================

    // Rule 1: Welcome 1 - فوری بعد از ایجاد لید
    await db.automationRule.upsert({
        where: { id: 1 },
        update: {},
        create: {
            name: 'Stage 1 - Welcome 1',
            description: 'ارسال فوری ایمیل و SMS خوشامدگویی بعد از ایجاد لید جدید',
            triggerType: 'ON_LEAD_CREATE',
            triggerStatus: 'New',
            delayMinutes: 0,
            emailTemplateId: welcome1Email.id,
            smsTemplateId: welcome1Sms.id,
            cancelOnStatus: 'Meeting1',
            cancelOnSubStatus: 'Scheduled',
            requireApproval: false, // فوری ارسال شه
            isActive: true,
            sortOrder: 1,
        }
    })

    // Rule 2: Welcome 2 - طبق منطق زمانی
    await db.automationRule.upsert({
        where: { id: 2 },
        update: {},
        create: {
            name: 'Stage 1 - Welcome 2',
            description: 'پیگیری اول اگر لید هنوز بوک نکرده',
            triggerType: 'ON_SCHEDULE',
            triggerStatus: 'New',
            delayMinutes: 0, // محاسبه میشه بر اساس زمان ایجاد لید
            scheduledHour: 14, // ۲ بعد از ظهر یا ۱۲ ظهر
            emailTemplateId: welcome2Email.id,
            smsTemplateId: welcome2Sms.id,
            cancelOnStatus: 'Meeting1',
            cancelOnSubStatus: 'Scheduled',
            requireApproval: true,
            isActive: true,
            sortOrder: 2,
        }
    })

    // Rule 3: Welcome 3 - طبق منطق زمانی
    await db.automationRule.upsert({
        where: { id: 3 },
        update: {},
        create: {
            name: 'Stage 1 - Welcome 3',
            description: 'پیگیری دوم اگر لید هنوز بوک نکرده',
            triggerType: 'ON_SCHEDULE',
            triggerStatus: 'New',
            delayMinutes: 0,
            scheduledHour: 19, // ۷ شب
            emailTemplateId: welcome3Email.id,
            smsTemplateId: welcome3Sms.id,
            cancelOnStatus: 'Meeting1',
            cancelOnSubStatus: 'Scheduled',
            requireApproval: true,
            isActive: true,
            sortOrder: 3,
        }
    })

    console.log('✅ Automation rules created')

    // ===================
    // APP SETTINGS
    // ===================
    await db.appSettings.upsert({
        where: { key: 'automation_approval_mode' },
        update: {},
        create: {
            key: 'automation_approval_mode',
            value: 'ask' // 'always' or 'ask'
        }
    })

    console.log('✅ Settings initialized')
    console.log('🎉 Seeding complete!')
}

seedAutomation()
    .catch(console.error)
    .finally(() => db.$disconnect())
