import React from 'react'
import { ArrowLeft, ShieldCheck, FileText, Mail, Info, AlertTriangle, MessageSquareWarning } from 'lucide-react'

const updated = '28 October 2026'
const pages = {
  about: { icon: Info, title: 'About KutchPharmaConnect', intro: 'A directory to help people discover pharmaceutical companies and distributor listings associated with Kutch, Gujarat.', sections: [
    ['What this directory does', 'KutchPharmaConnect helps users search company, subsidiary, brand, product-catalogue and distributor information in one place. It provides directory information and contact links so users can contact businesses directly.'],
    ['How listings should be understood', 'A company listing or company–distributor relationship does not necessarily mean a distributor currently handles a particular product, has stock, serves every location, or is authorised by a manufacturer. Check details directly with the relevant business.'],
    ['Independence', 'Unless a listing explicitly says otherwise, a directory entry is not an endorsement, sponsorship, agency relationship, or official manufacturer authorisation.'],
    ['Corrections', 'Use Report Incorrect Information or the contact options on the website to report inaccurate or outdated information.']
  ]},
  privacy: { icon: ShieldCheck, title: 'Privacy Policy', intro: 'How KutchPharmaConnect may handle information when you use the directory, submit feedback, or contact a listed business.', sections: [
    ['Information collected', 'Correction reports and feedback may include your name, mobile or WhatsApp number, email address, and the issue you report. Directory submissions may include business names, business contact details, addresses, and company–distributor relationships. Do not submit passwords, government identity numbers, patient details, prescriptions, or other sensitive personal information.'],
    ['How information is used', 'Submitted information is used to review corrections, maintain directory quality, respond to requests, prevent abuse, and operate or improve the service. Contact details may be used to verify a report if necessary.'],
    ['Analytics and technical information', 'The website uses Google Analytics tags to understand general usage, such as page visits and interactions. Google and service providers may process technical data, cookies, identifiers, or similar information according to their own policies and settings. Browser settings and available consent controls may affect this processing.'],
    ['Third-party services', 'The directory may link to WhatsApp, telephone diallers, Google Maps, company websites, and other services. Their own terms and privacy policies apply when you use them. KutchPharmaConnect does not control their independent data practices.'],
    ['Sharing and retention', 'Information may be accessed by the site administrator and providers operating the website, database, analytics, or submission workflow. It is not intentionally collected for sale. Information may be retained as needed to resolve reports, maintain records, protect the service, or meet legal requirements. Submissions are not confidential from the administrator.'],
    ['Security', 'Reasonable safeguards should be used, but no internet transmission or storage system can be guaranteed completely secure. Do not send confidential or highly sensitive information through the directory.'],
    ['Your choices', 'You may contact the administrator to request access to, correction of, or deletion of personal information you submitted, subject to identity verification, operational needs, and applicable law. You can adjust browser cookie settings and Google account settings where available.'],
    ['Changes', 'This policy may be updated as the service changes. The date above is the latest stated update.']
  ]},
  terms: { icon: FileText, title: 'Terms of Use', intro: 'Use KutchPharmaConnect lawfully and independently verify important information.', sections: [
    ['Purpose', 'The site is an informational directory for discovering pharmaceutical companies and distributor listings associated with Kutch, Gujarat.'],
    ['Accuracy and availability', 'Listings may be incomplete, outdated, user-submitted, or awaiting verification. We do not guarantee accuracy, completeness, current stock, pricing, territory coverage, product handling, business status, or uninterrupted availability. Confirm details directly with the relevant business.'],
    ['No medical advice', 'The directory is not a medical service and does not provide diagnosis, prescribing, treatment recommendations, or patient-specific advice. It is not a substitute for advice from a qualified healthcare professional.'],
    ['Permitted use', 'Do not attempt unauthorised access, interfere with the site, harvest contact data unlawfully, send spam, impersonate a person or business, or submit misleading, unlawful, defamatory, or infringing material.'],
    ['Submissions', 'Submit information only when you have a lawful basis to provide it. You are responsible for the accuracy of material you submit. Submissions may be reviewed, edited for clarity, declined, or removed where appropriate.'],
    ['External services and rights', 'Third-party links are provided for convenience and do not imply endorsement. Do not copy or reuse website content, branding, or database material in violation of applicable rights.'],
    ['Limitations', 'To the extent permitted by applicable law, the site is provided on an as-available basis without guarantees that every listing or service will be error-free. Nothing excludes liability that cannot lawfully be excluded.'],
    ['Changes and law', 'These terms may be revised. Applicable Indian law may govern use of the service, subject to mandatory legal requirements and competent courts.']
  ]},
  disclaimer: { icon: AlertTriangle, title: 'Directory Disclaimer', intro: 'Verify company, distributor, product, and contact information before relying on it.', sections: [
    ['Independent directory', 'KutchPharmaConnect is a directory, not a pharmacy, wholesaler, stockist, manufacturer, regulator, or medical provider. A listing is not proof of official appointment or authorisation.'],
    ['Verify details', 'Relationships, territories, addresses, phone numbers, business status, product handling, prices, and stock availability can change. Contact the business and, where necessary, the manufacturer or authorised representative to verify information.'],
    ['Product catalogue', 'Product entries are informational references only. Their presence does not confirm availability, current marketing status, price, authenticity, suitability, or that a listed distributor handles that specific product.'],
    ['No medical advice', 'Nothing on this website recommends using, prescribing, dispensing, purchasing, or substituting a medicine. Decisions about medicines must involve qualified healthcare professionals and comply with applicable regulations.'],
    ['Third-party actions', 'Calls, WhatsApp messages, map directions, and external websites open services operated by third parties. Users and businesses are responsible for their communications and transactions.']
  ]},
  corrections: { icon: MessageSquareWarning, title: 'Corrections and Listing Standards', intro: 'Help keep the directory useful by reporting outdated or inaccurate information.', sections: [
    ['What to report', 'Incorrect names, outdated phone numbers or addresses, incorrect company–distributor relationships, incorrect locations, duplicate records, and other factual errors.'],
    ['Review process', 'Reports may be checked against reliable public information or confirmed with the relevant business. A report does not automatically change a listing; additional information may be requested.'],
    ['Verification labels', 'A verification label applies only to the specific record or relationship described by it. It is not a guarantee of product stock, quality, regulatory compliance, or every activity of a business.'],
    ['Avoid sensitive information', 'Do not include patient information, prescriptions, confidential commercial documents, passwords, or unnecessary personal information in a report.']
  ]},
  contact: { icon: Mail, title: 'Contact KutchPharmaConnect', intro: 'For corrections, listing questions, privacy requests, or website issues, use the administrator contact options in the website footer.', sections: [
    ['Directory corrections', 'Use Report Incorrect Information to identify the listing and explain the correction. Provide contact details only if you are comfortable being contacted to verify the report.'],
    ['Privacy requests', 'Identify the relevant report or submission so the administrator can locate it. Do not send passwords or identity documents through ordinary WhatsApp messages.'],
    ['Business enquiries', 'For current stock, product handling, pricing, distributorship status, or orders, contact the listed business directly. KutchPharmaConnect does not complete or guarantee transactions between users and listed businesses.']
  ]}
}
export default function PolicyPages({ page = 'about', onBack }) {
  const data = pages[page] || pages.about
  const Icon = data.icon
  return <section className="policy-page"><div className="container policy-container">
    <button className="back-button" onClick={onBack}><ArrowLeft size={16}/> Back to directory</button>
    <header className="policy-heading"><span className="policy-icon"><Icon size={22}/></span><div><p className="section-kicker">KUTCHPHARMACONNECT · WEBSITE INFORMATION</p><h1>{data.title}</h1><p>{data.intro}</p></div></header>
    <p className="policy-updated">Last updated: {updated}</p>
    {data.sections.map(([heading, body]) => <section className="policy-section" key={heading}><h2>{heading}</h2><p>{body}</p></section>)}
    <p className="policy-note">This is general website information, not legal advice. The operator should review these policies against the actual data flows and applicable law before treating them as a compliance guarantee.</p>
  </div></section>
}
