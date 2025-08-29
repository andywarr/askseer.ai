import { redirect } from "next/navigation";
import { headers } from "next/headers";

// Lib imports
import { logger } from "@/apps/shared/logger.ts";

// Custom components
import { GlobalHeader } from "@/apps/nextjs-app/components/global-header";

export default async function Page() {
  const headersList = await headers();

  // Log privacy page view
  logger.info("Privacy page viewed", {
    page: "/privacy",
    action: "view",
    userAgent: headersList.get("user-agent"),
    referer: headersList.get("referer"),
  });
  return (
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col p-8">
      <GlobalHeader activePage="home" />
      <h1 className="scroll-m-20 text-balance text-center font-parisienne text-7xl tracking-tight">
        Privacy
      </h1>
      <p className="mt-8 leading-7 not-first:mt-6">
        This privacy notice for Seer (&ldquo;we,&rdquo; &ldquo;us,&rdquo; or
        &ldquo;our&rdquo;), describes how and why we might collect, store, use,
        and/or share (&ldquo;process&rdquo;) your information when you use our
        services (&ldquo;Services&rdquo;), such as when you:
      </p>
      <ul className="my-6 ml-6 list-disc leading-7 [&>li]:mt-2">
        <li>
          Visit our website at askseer.ai, or any website of ours that links to
          this privacy notice
        </li>
        <li>
          Engage with us in other related ways, including any sales, marketing,
          or events
        </li>
      </ul>
      <p className="mt-8 leading-7 not-first:mt-6">
        Questions or concerns? Reading this privacy notice will help you
        understand your privacy rights and choices. If you do not agree with our
        policies and practices, please do not use our Services. If you still
        have any questions or concerns, please contact us referring to the
        contact details at the bottom of this document.
      </p>
      <h3 className="mt-16 scroll-m-20 text-2xl font-semibold tracking-tight">
        Summary of key points
      </h3>
      <p className="mt-8 leading-7 not-first:mt-6">
        This summary provides key points from our privacy policy, but you can
        find out more details about any of these topics by clicking the link
        following each key point or by using our table of contents below to find
        the section you are looking for.
      </p>
      <p className="mt-8 leading-7 not-first:mt-6">
        <strong>What personal information do we process?</strong> When you
        visit, use, or navigate our Services, we may process personal
        information depending on how you interact with us and the Services, the
        choices you make, and the products and features you use.
      </p>
      <p className="mt-8 leading-7 not-first:mt-6">
        <strong>Do we process any sensitive personal information?</strong> We do
        not process sensitive personal information.
      </p>
      <p className="mt-8 leading-7 not-first:mt-6">
        <strong>Do we collect any information from third parties?</strong> We do
        not collect any information from third parties.
      </p>
      <p className="mt-8 leading-7 not-first:mt-6">
        <strong>How do we process your information?</strong> We process your
        information to provide, improve, and administer our Services,
        communicate with you, for security and fraud prevention, and to comply
        with law. We may also process your information for other purposes with
        your consent. We process your information only when we have a valid
        legal reason to do so.
      </p>
      <p className="mt-8 leading-7 not-first:mt-6">
        <strong>
          In what situations and with which parties do we share personal
          information?
        </strong>{" "}
        We may share information in specific situations and with specific third
        parties, as described in the section{" "}
        <a href="#section-4" className="text-blue-600 hover:underline">
          &ldquo;When and with whom do we share your personal
          information?&rdquo;
        </a>
      </p>
      <p className="mt-8 leading-7 not-first:mt-6">
        <strong>How do we keep your information safe?</strong> We have
        organizational and technical processes and procedures in place to
        protect your personal information. However, no electronic transmission
        over the internet or information storage technology can be guaranteed to
        be 100% secure, so we cannot promise or guarantee that hackers,
        cybercriminals, or other unauthorized third parties will not be able to
        defeat our security and improperly collect, access, steal, or modify
        your information.
      </p>
      <p className="mt-8 leading-7 not-first:mt-6">
        <strong>What are your rights?</strong> Depending on where you are
        located geographically, the applicable privacy law may mean you have
        certain rights regarding your personal information.
      </p>
      <p className="mt-8 leading-7 not-first:mt-6">
        <strong>How do you exercise your rights?</strong> The easiest way to
        exercise your rights is by submitting a data subject access request by
        contacting us referring to the contact details at the bottom of this
        document. We will consider and act upon any request in accordance with
        applicable data protection laws.
      </p>
      <p className="mt-8 leading-7 not-first:mt-6">
        Want to learn more about what we do with any information we collect?
        Review the privacy notice in full below.
      </p>

      <h3 className="mt-16 scroll-m-20 text-2xl font-semibold tracking-tight">
        Table of contents
      </h3>
      <ol className="my-6 ml-6 list-decimal leading-7 [&>li]:mt-2">
        <li>
          <a href="#section-1" className="text-blue-600 hover:underline">
            What information do we collect?
          </a>
        </li>
        <li>
          <a href="#section-2" className="text-blue-600 hover:underline">
            How do we process your information?
          </a>
        </li>
        <li>
          <a href="#section-3" className="text-blue-600 hover:underline">
            What legal bases do we rely on to process your personal information?
          </a>
        </li>
        <li>
          <a href="#section-4" className="text-blue-600 hover:underline">
            When and with whom do we share your personal information?
          </a>
        </li>
        <li>
          <a href="#section-5" className="text-blue-600 hover:underline">
            Do we offer artificial intelligence-based products?
          </a>
        </li>
        <li>
          <a href="#section-6" className="text-blue-600 hover:underline">
            How do we handle your social logins?
          </a>
        </li>
        <li>
          <a href="#section-7" className="text-blue-600 hover:underline">
            How long do we keep your information?
          </a>
        </li>
        <li>
          <a href="#section-8" className="text-blue-600 hover:underline">
            How do we keep your information safe?
          </a>
        </li>
        <li>
          <a href="#section-9" className="text-blue-600 hover:underline">
            Do we collect information from minors?
          </a>
        </li>
        <li>
          <a href="#section-10" className="text-blue-600 hover:underline">
            What are your privacy rights?
          </a>
        </li>
        <li>
          <a href="#section-11" className="text-blue-600 hover:underline">
            Controls for do-not-track features
          </a>
        </li>
        <li>
          <a href="#section-12" className="text-blue-600 hover:underline">
            Do United States residents have specific privacy rights?
          </a>
        </li>
        <li>
          <a href="#section-13" className="text-blue-600 hover:underline">
            Do we make updates to this notice?
          </a>
        </li>
        <li>
          <a href="#section-14" className="text-blue-600 hover:underline">
            How can you contact us about this notice?
          </a>
        </li>
        <li>
          <a href="#section-15" className="text-blue-600 hover:underline">
            How can you review, update, or delete the data we collect from you?
          </a>
        </li>
      </ol>

      <h3
        id="section-1"
        className="mt-16 scroll-m-20 text-2xl font-semibold tracking-tight"
      >
        1. What information do we collect?
      </h3>
      <h4 className="mt-8 scroll-m-20 text-xl font-semibold tracking-tight">
        Personal information you disclose to us
      </h4>
      <p className="mt-4 leading-7 not-first:mt-6">
        <em>
          In Short: We collect personal information that you provide to us.
        </em>
      </p>
      <p className="mt-8 leading-7 not-first:mt-6">
        We collect personal information that you voluntarily provide to us when
        you register on the Services, express an interest in obtaining
        information about us or our products and Services, when you participate
        in activities on the Services, or otherwise when you contact us
        referring to the contact details at the bottom of this document.
      </p>
      <p className="mt-8 leading-7 not-first:mt-6">
        <strong>Personal Information Provided by You.</strong> The personal
        information that we collect depends on the context of your interactions
        with us and the Services, the choices you make, and the products and
        features you use. The personal information we collect may include the
        following:
      </p>
      <ul className="my-6 ml-6 list-disc leading-7 [&>li]:mt-2">
        <li>Email address</li>
        <li>Name</li>
      </ul>
      <p className="mt-8 leading-7 not-first:mt-6">
        <strong>Sensitive Information.</strong> We do not process sensitive
        information.
      </p>
      <p className="mt-8 leading-7 not-first:mt-6">
        <strong>Social Media Login Data.</strong> We may provide you with the
        option to register with us using your existing social media account
        details, like your Google, Facebook, X, or other social media account.
        If you choose to register in this way, we will collect certain profile
        information about you from the social media provider, as described in
        the section called{" "}
        <a href="#section-6" className="text-blue-600 hover:underline">
          &ldquo;How do we handle your social logins?&rdquo;
        </a>
        &nbsp;below.
      </p>
      <p className="mt-8 leading-7 not-first:mt-6">
        All personal information that you provide to us must be true, complete,
        and accurate, and you must notify us of any changes to such personal
        information.
      </p>

      <h4 className="mt-8 scroll-m-20 text-xl font-semibold tracking-tight">
        Information automatically collected
      </h4>
      <p className="mt-4 leading-7 not-first:mt-6">
        <em>
          In Short: Some information — such as your Internet Protocol (IP)
          address and/or browser and device characteristics — is collected
          automatically when you visit our Services.
        </em>
      </p>
      <p className="mt-8 leading-7 not-first:mt-6">
        We automatically collect certain information when you visit, use, or
        navigate the Services. This information does not reveal your specific
        identity (like your name or contact information) but may include device
        and usage information, such as your IP address, browser and device
        characteristics, operating system, language preferences, referring URLs,
        device name, country, location, information about how and when you use
        our Services, and other technical information. This information is
        primarily needed to maintain the security and operation of our Services,
        and for our internal analytics and reporting purposes.
      </p>
      <p className="mt-8 leading-7 not-first:mt-6">
        The information we collect includes:
      </p>
      <ul className="my-6 ml-6 list-disc leading-7 [&>li]:mt-2">
        <li>
          <strong>Log and Usage Data.</strong> Log and usage data is
          service-related, diagnostic, usage, and performance information our
          servers automatically collect when you access or use our Services and
          which we record in log files. Depending on how you interact with us,
          this log data may include your IP address, device information, browser
          type, and settings and information about your activity in the Services
          (such as the date/time stamps associated with your usage, pages and
          files viewed, searches, and other actions you take such as which
          features you use), device event information (such as system activity,
          error reports (sometimes called &ldquo;crash dumps&rdquo;), and
          hardware settings).
        </li>
        <li>
          <strong>Device Data.</strong> We collect device data such as
          information about your computer, phone, tablet, or other device you
          use to access the Services. Depending on the device used, this device
          data may include information such as your IP address (or proxy
          server), device and application identification numbers, location,
          browser type, hardware model, Internet service provider and/or mobile
          carrier, operating system, and system configuration information.
        </li>
        <li>
          <strong>Location Data.</strong> We collect location data such as
          information about your device&apos;s location, which can be either
          precise or imprecise. How much information we collect depends on the
          type and settings of the device you use to access the Services. For
          example, we may use GPS and other technologies to collect geolocation
          data that tells us your current location (based on your IP address).
          You can opt out of allowing us to collect this information either by
          refusing access to the information or by disabling your Location
          setting on your device. However, if you choose to opt out, you may not
          be able to use certain aspects of the Services.
        </li>
      </ul>

      <h4 className="mt-8 scroll-m-20 text-xl font-semibold tracking-tight">
        Google API
      </h4>
      <p className="mt-4 leading-7 not-first:mt-6">
        Our use of information received from Google APIs will adhere to{" "}
        <a
          href="https://developers.google.com/terms/api-services-user-data-policy"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline"
        >
          Google API Services User Data Policy
        </a>
        , including the{" "}
        <a
          href="https://developers.google.com/terms/api-services-user-data-policy#limited-use"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline"
        >
          Limited Use requirements
        </a>
        .
      </p>

      <h3
        id="section-2"
        className="mt-16 scroll-m-20 text-2xl font-semibold tracking-tight"
      >
        2. How do we process your information?
      </h3>
      <p className="mt-4 leading-7 not-first:mt-6">
        <em>
          In Short: We process your information to provide, improve, and
          administer our Services, communicate with you, for security and fraud
          prevention, and to comply with law. We may also process your
          information for other purposes with your consent.
        </em>
      </p>
      <p className="mt-8 leading-7 not-first:mt-6">
        We process your personal information for a variety of reasons, depending
        on how you interact with our Services, including:
      </p>
      <ul className="my-6 ml-6 list-disc leading-7 [&>li]:mt-2">
        <li>
          <strong>
            To facilitate account creation and authentication and otherwise
            manage user accounts.
          </strong>{" "}
          We may process your information so you can create and log in to your
          account, as well as keep your account in working order.
        </li>
        <li>
          <strong>To request feedback.</strong> We may process your information
          when necessary to request feedback and to contact you about your use
          of our Services.
        </li>
        <li>
          <strong>To identify usage trends.</strong> We may process information
          about how you use our Services to better understand how they are being
          used so we can improve them.
        </li>
        <li>
          <strong>
            To save or protect an individual&apos;s vital interest.
          </strong>{" "}
          We may process your information when necessary to save or protect an
          individual&apos;s vital interest, such as to prevent harm.
        </li>
      </ul>

      <h3
        id="section-3"
        className="mt-16 scroll-m-20 text-2xl font-semibold tracking-tight"
      >
        3. What legal bases do we rely on to process your information?
      </h3>
      <p className="mt-4 leading-7 not-first:mt-6">
        <em>
          In Short: We only process your personal information when we believe it
          is necessary and we have a valid legal reason (i.e., legal basis) to
          do so under applicable law, like with your consent, to comply with
          laws, to provide you with services to enter into or fulfill our
          contractual obligations, to protect your rights, or to fulfill our
          legitimate business interests.
        </em>
      </p>
      <p className="mt-8 leading-7 not-first:mt-6">
        <strong>
          If you are located in the EU or UK, this section applies to you.
        </strong>
      </p>
      <p className="mt-8 leading-7 not-first:mt-6">
        The General Data Protection Regulation (GDPR) and UK GDPR require us to
        explain the valid legal bases we rely on in order to process your
        personal information. As such, we may rely on the following legal bases
        to process your personal information:
      </p>
      <ul className="my-6 ml-6 list-disc leading-7 [&>li]:mt-2">
        <li>
          <strong>Consent.</strong> We may process your information if you have
          given us permission (i.e., consent) to use your personal information
          for a specific purpose. You can withdraw your consent at any time.
          Contact us referring to the contact details at the bottom of this
          document to withdraw your consent.
        </li>
        <li>
          <strong>Legitimate Interests.</strong> We may process your information
          when we believe it is reasonably necessary to achieve our legitimate
          business interests and those interests do not outweigh your interests
          and fundamental rights and freedoms. For example, we may process your
          personal information for some of the purposes described in order to:
          <ul className="my-4 ml-6 list-disc leading-7 [&>li]:mt-2">
            <li>
              Analyze how our Services are used so we can improve them to engage
              and retain users
            </li>
            <li>
              Understand how our users use our products and services so we can
              improve user experience
            </li>
          </ul>
        </li>
        <li>
          <strong>Legal Obligations.</strong> We may process your information
          where we believe it is necessary for compliance with our legal
          obligations, such as to cooperate with a law enforcement body or
          regulatory agency, exercise or defend our legal rights, or disclose
          your information as evidence in litigation in which we are involved.
        </li>
        <li>
          <strong>Vital Interests.</strong> We may process your information
          where we believe it is necessary to protect your vital interests or
          the vital interests of a third party, such as situations involving
          potential threats to the safety of any person.
        </li>
      </ul>
      <p className="mt-8 leading-7 not-first:mt-6">
        <strong>
          If you are located in Canada, this section applies to you.
        </strong>
      </p>
      <p className="mt-8 leading-7 not-first:mt-6">
        We may process your information if you have given us specific permission
        (i.e., express consent) to use your personal information for a specific
        purpose, or in situations where your permission can be inferred (i.e.,
        implied consent). You can withdraw your consent at any time.
      </p>
      <p className="mt-8 leading-7 not-first:mt-6">
        In some exceptional cases, we may be legally permitted under applicable
        law to process your information without your consent, including, for
        example:
      </p>
      <ul className="my-6 ml-6 list-disc leading-7 [&>li]:mt-2">
        <li>
          If collection is clearly in the interests of an individual and consent
          cannot be obtained in a timely way
        </li>
        <li>For investigations and fraud detection and prevention</li>
        <li>For business transactions provided certain conditions are met</li>
        <li>
          If it is contained in a witness statement and the collection is
          necessary to assess, process, or settle an insurance claim
        </li>
        <li>
          For identifying injured, ill, or deceased persons and communicating
          with next of kin
        </li>
        <li>
          If we have reasonable grounds to believe an individual has been, is,
          or may be victim of financial abuse
        </li>
        <li>
          If it is reasonable to expect collection and use with consent would
          compromise the availability or the accuracy of the information and the
          collection is reasonable for purposes related to investigating a
          breach of an agreement or a contravention of the laws of Canada or a
          province
        </li>
        <li>
          If disclosure is required to comply with a subpoena, warrant, court
          order, or rules of the court relating to the production of records
        </li>
        <li>
          If it was produced by an individual in the course of their employment,
          business, or profession and the collection is consistent with the
          purposes for which the information was produced
        </li>
        <li>
          If the collection is solely for journalistic, artistic, or literary
          purposes
        </li>
        <li>
          If the information is publicly available and is specified by the
          regulations
        </li>
      </ul>

      <h3
        id="section-4"
        className="mt-16 scroll-m-20 text-2xl font-semibold tracking-tight"
      >
        4. When and with whom do we share your personal information?
      </h3>
      <p className="mt-4 leading-7 not-first:mt-6">
        <em>
          In Short: We may share information in specific situations described in
          this section and/or with the following third parties.
        </em>
      </p>
      <p className="mt-8 leading-7 not-first:mt-6">
        We may need to share your personal information in the following
        situations:
      </p>
      <ul className="my-6 ml-6 list-disc leading-7 [&>li]:mt-2">
        <li>
          <strong>Business Transfers.</strong> We may share or transfer your
          information in connection with, or during negotiations of, any merger,
          sale of company assets, financing, or acquisition of all or a portion
          of our business to another company.
        </li>
      </ul>

      <h3
        id="section-5"
        className="mt-16 scroll-m-20 text-2xl font-semibold tracking-tight"
      >
        5. Do we offer artificial intelligence-based products?
      </h3>
      <p className="mt-4 leading-7 not-first:mt-6">
        <em>
          In Short: We offer products, features, or tools powered by artificial
          intelligence, machine learning, or similar technologies.
        </em>
      </p>
      <p className="mt-8 leading-7 not-first:mt-6">
        As part of our Services, we offer products, features, or tools powered
        by artificial intelligence, machine learning, or similar technologies
        (collectively, &ldquo;AI Products&rdquo;). These tools are designed to
        enhance your experience and provide you with innovative solutions. The
        terms in this privacy notice govern your use of the AI Products within
        our Services.
      </p>

      <h4 className="mt-8 scroll-m-20 text-xl font-semibold tracking-tight">
        Use of AI Technologies
      </h4>
      <p className="mt-4 leading-7 not-first:mt-6">
        We provide the AI Products through third-party service providers
        (&ldquo;AI Service Providers&rdquo;), including OpenAI. As outlined in
        this privacy notice, your input, output, and personal information will
        be shared with and processed by these AI Service Providers to enable
        your use of our AI Products for purposes outlined in &ldquo;WHAT LEGAL
        BASES DO WE RELY ON TO PROCESS YOUR PERSONAL INFORMATION?&rdquo; You
        must not use the AI Products in any way that violates the terms or
        policies of any AI Service Provider.
      </p>

      <h4 className="mt-8 scroll-m-20 text-xl font-semibold tracking-tight">
        Our AI Products
      </h4>
      <p className="mt-4 leading-7 not-first:mt-6">
        Our AI Products are designed for the following functions:
      </p>
      <ul className="my-6 ml-6 list-disc leading-7 [&>li]:mt-2">
        <li>AI insights</li>
      </ul>

      <h4 className="mt-8 scroll-m-20 text-xl font-semibold tracking-tight">
        How We Process Your Data Using AI
      </h4>
      <p className="mt-4 leading-7 not-first:mt-6">
        All personal information processed using our AI Products is handled in
        line with our privacy notice and our agreement with third parties. This
        ensures high security and safeguards your personal information
        throughout the process, giving you peace of mind about your data&apos;s
        safety.
      </p>

      <h3
        id="section-6"
        className="mt-16 scroll-m-20 text-2xl font-semibold tracking-tight"
      >
        6. How do we handle your social logins?
      </h3>
      <p className="mt-4 leading-7 not-first:mt-6">
        <em>
          In Short: If you choose to register or log in to our Services using a
          social media account, we may have access to certain information about
          you.
        </em>
      </p>
      <p className="mt-8 leading-7 not-first:mt-6">
        Our Services offer you the ability to register and log in using your
        third-party social media account details (like your Google, Facebook or
        X logins). Where you choose to do this, we will receive certain profile
        information about you from your social media provider. The profile
        information we receive may vary depending on the social media provider
        concerned, but will often include your name, email address, friends
        list, and profile picture, as well as other information you choose to
        make public on such a social media platform.
      </p>
      <p className="mt-8 leading-7 not-first:mt-6">
        We will use the information we receive only for the purposes that are
        described in this privacy notice or that are otherwise made clear to you
        on the relevant Services. Please note that we do not control, and are
        not responsible for, other uses of your personal information by your
        third-party social media provider. We recommend that you review their
        privacy notice to understand how they collect, use, and share your
        personal information, and how you can set your privacy preferences on
        their sites and apps.
      </p>

      <h3
        id="section-7"
        className="mt-16 scroll-m-20 text-2xl font-semibold tracking-tight"
      >
        7. How long do we keep your information?
      </h3>
      <p className="mt-4 leading-7 not-first:mt-6">
        <em>
          In Short: We keep your information for as long as necessary to fulfill
          the purposes outlined in this privacy notice unless otherwise required
          by law.
        </em>
      </p>
      <p className="mt-8 leading-7 not-first:mt-6">
        We will only keep your personal information for as long as it is
        necessary for the purposes set out in this privacy notice, unless a
        longer retention period is required or permitted by law (such as tax,
        accounting, or other legal requirements). No purpose in this notice will
        require us to keep your personal information for longer than the period
        of time in which users have an account with us.
      </p>
      <p className="mt-8 leading-7 not-first:mt-6">
        When we have no ongoing legitimate business need to process your
        personal information, we will either delete or anonymize such
        information, or, if this is not possible (for example, because your
        personal information has been stored in backup archives), then we will
        securely store your personal information and isolate it from any further
        processing until deletion is possible.
      </p>

      <h3
        id="section-8"
        className="mt-16 scroll-m-20 text-2xl font-semibold tracking-tight"
      >
        8. How do we keep your information safe?
      </h3>
      <p className="mt-4 leading-7 not-first:mt-6">
        <em>
          In Short: We aim to protect your personal information through a system
          of organizational and technical security measures.
        </em>
      </p>
      <p className="mt-8 leading-7 not-first:mt-6">
        We have implemented appropriate and reasonable technical and
        organizational security measures designed to protect the security of any
        personal information we process. However, despite our safeguards and
        efforts to secure your information, no electronic transmission over the
        Internet or information storage technology can be guaranteed to be 100%
        secure, so we cannot promise or guarantee that hackers, cybercriminals,
        or other unauthorized third parties will not be able to defeat our
        security and improperly collect, access, steal, or modify your
        information. Although we will do our best to protect your personal
        information, transmission of personal information to and from our
        Services is at your own risk. You should only access the Services within
        a secure environment.
      </p>

      <h3
        id="section-9"
        className="mt-16 scroll-m-20 text-2xl font-semibold tracking-tight"
      >
        9. Do we collect information from minors?
      </h3>
      <p className="mt-4 leading-7 not-first:mt-6">
        <em>
          In Short: We do not knowingly collect data from or market to children
          under 18 years of age.
        </em>
      </p>
      <p className="mt-8 leading-7 not-first:mt-6">
        We do not knowingly collect, solicit data from, or market to children
        under 18 years of age, nor do we knowingly sell such personal
        information. By using the Services, you represent that you are at least
        18 or that you are the parent or guardian of such a minor and consent to
        such minor dependent&apos;s use of the Services. If we learn that
        personal information from users less than 18 years of age has been
        collected, we will deactivate the account and take reasonable measures
        to promptly delete such data from our records. If you become aware of
        any data we may have collected from children under age 18, please
        contact us referring to the contact details at the bottom of this
        document.
      </p>

      <h3
        id="section-10"
        className="mt-16 scroll-m-20 text-2xl font-semibold tracking-tight"
      >
        10. What are your privacy rights?
      </h3>
      <p className="mt-4 leading-7 not-first:mt-6">
        <em>
          In Short: Depending on your state of residence in the US or in some
          regions, such as the European Economic Area (EEA), United Kingdom
          (UK), Switzerland, and Canada, you have rights that allow you greater
          access to and control over your personal information. You may review,
          change, or terminate your account at any time, depending on your
          country, province, or state of residence.
        </em>
      </p>
      <p className="mt-8 leading-7 not-first:mt-6">
        In some regions (like the EEA, UK, Switzerland, and Canada), you have
        certain rights under applicable data protection laws. These may include
        the right (i) to request access and obtain a copy of your personal
        information, (ii) to request rectification or erasure; (iii) to restrict
        the processing of your personal information; (iv) if applicable, to data
        portability; and (v) not to be subject to automated decision-making. In
        certain circumstances, you may also have the right to object to the
        processing of your personal information. You can make such a request by
        contacting us referring to the contact details at the bottom of this
        document.
      </p>
      <p className="mt-8 leading-7 not-first:mt-6">
        We will consider and act upon any request in accordance with applicable
        data protection laws.
      </p>
      <p className="mt-8 leading-7 not-first:mt-6">
        If you are located in the EEA or UK and you believe we are unlawfully
        processing your personal information, you also have the right to
        complain to your{" "}
        <a
          href="https://ec.europa.eu/justice/data-protection/bodies/authorities/index_en.htm"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline"
        >
          Member State data protection authority
        </a>{" "}
        or{" "}
        <a
          href="https://ico.org.uk/make-a-complaint/data-protection-complaints/data-protection-complaints/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline"
        >
          UK data protection authority
        </a>
        .
      </p>
      <p className="mt-8 leading-7 not-first:mt-6">
        If you are located in Switzerland, you may contact the{" "}
        <a
          href="https://www.edoeb.admin.ch/edoeb/en/home.html"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline"
        >
          Federal Data Protection and Information Commissioner
        </a>
        .
      </p>
      <p className="mt-8 leading-7 not-first:mt-6">
        <strong>Withdrawing your consent:</strong> If we are relying on your
        consent to process your personal information, which may be express
        and/or implied consent depending on the applicable law, you have the
        right to withdraw your consent at any time. You can withdraw your
        consent at any time by contacting us referring to the contact details at
        the bottom of this document or updating your preferences.
      </p>
      <p className="mt-8 leading-7 not-first:mt-6">
        However, please note that this will not affect the lawfulness of the
        processing before its withdrawal nor, when applicable law allows, will
        it affect the processing of your personal information conducted in
        reliance on lawful processing grounds other than consent.
      </p>

      <h4 className="mt-8 scroll-m-20 text-xl font-semibold tracking-tight">
        Account Information
      </h4>
      <p className="mt-4 leading-7 not-first:mt-6">
        If you would at any time like to review or change the information in
        your account or terminate your account, you can:
      </p>
      <ul className="my-6 ml-6 list-disc leading-7 [&>li]:mt-2">
        <li>
          Contact us referring to the contact details at the bottom of this
          document.
        </li>
        <li>Log in to your account settings and update your user account.</li>
      </ul>
      <p className="mt-8 leading-7 not-first:mt-6">
        Upon your request to terminate your account, we will deactivate or
        delete your account and information from our active databases. However,
        we may retain some information in our files to prevent fraud,
        troubleshoot problems, assist with any investigations, enforce our legal
        terms and/or comply with applicable legal requirements.
      </p>
      <p className="mt-8 leading-7 not-first:mt-6">
        If you have questions or comments about your privacy rights, you may
        contact us.
      </p>

      <h3
        id="section-11"
        className="mt-16 scroll-m-20 text-2xl font-semibold tracking-tight"
      >
        11. Controls for do-not-track features
      </h3>
      <p className="mt-4 leading-7 not-first:mt-6">
        Most web browsers and some mobile operating systems and mobile
        applications include a Do-Not-Track (&ldquo;DNT&rdquo;) feature or
        setting you can activate to signal your privacy preference not to have
        data about your online browsing activities monitored and collected. At
        this stage, no uniform technology standard for recognizing and
        implementing DNT signals has been finalized. As such, we do not
        currently respond to DNT browser signals or any other mechanism that
        automatically communicates your choice not to be tracked online. If a
        standard for online tracking is adopted that we must follow in the
        future, we will inform you about that practice in a revised version of
        this privacy notice.
      </p>
      <p className="mt-8 leading-7 not-first:mt-6">
        California law requires us to let you know how we respond to web browser
        DNT signals. Because there currently is not an industry or legal
        standard for recognizing or honoring DNT signals, we do not respond to
        them at this time.
      </p>

      <h3
        id="section-12"
        className="mt-16 scroll-m-20 text-2xl font-semibold tracking-tight"
      >
        12. Do United States residents have specific privacy rights?
      </h3>
      <p className="mt-4 leading-7 not-first:mt-6">
        <em>
          In Short: If you are a resident of California, Colorado, Connecticut,
          Delaware, Florida, Indiana, Iowa, Kentucky, Montana, New Hampshire,
          New Jersey, Oregon, Tennessee, Texas, Utah, or Virginia, you may have
          the right to request access to and receive details about the personal
          information we maintain about you and how we have processed it,
          correct inaccuracies, get a copy of, or delete your personal
          information. You may also have the right to withdraw your consent to
          our processing of your personal information. These rights may be
          limited in some circumstances by applicable law. More information is
          provided below.
        </em>
      </p>

      <h4 className="mt-8 scroll-m-20 text-xl font-semibold tracking-tight">
        Categories of Personal Information We Collect
      </h4>
      <p className="mt-4 leading-7 not-first:mt-6">
        We have collected the following categories of personal information in
        the past twelve (12) months:
      </p>
      <div className="mt-8 overflow-x-auto">
        <table className="w-full border-collapse border border-gray-200">
          <thead>
            <tr className="bg-gray-50">
              <th className="border border-gray-200 px-4 py-2 text-left font-semibold">
                Category
              </th>
              <th className="border border-gray-200 px-4 py-2 text-left font-semibold">
                Examples
              </th>
              <th className="border border-gray-200 px-4 py-2 text-left font-semibold">
                Collected
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-gray-200 px-4 py-2">
                A. Identifiers
              </td>
              <td className="border border-gray-200 px-4 py-2">
                Contact details, such as real name, alias, postal address,
                telephone or mobile contact number, unique personal identifier,
                online identifier, Internet Protocol address, email address, and
                account name
              </td>
              <td className="border border-gray-200 px-4 py-2">YES</td>
            </tr>
            <tr>
              <td className="border border-gray-200 px-4 py-2">
                B. Personal information as defined in the California Customer
                Records statute
              </td>
              <td className="border border-gray-200 px-4 py-2">
                Name, contact information, education, employment, employment
                history, and financial information
              </td>
              <td className="border border-gray-200 px-4 py-2">YES</td>
            </tr>
            <tr>
              <td className="border border-gray-200 px-4 py-2">
                C. Protected classification characteristics under state or
                federal law
              </td>
              <td className="border border-gray-200 px-4 py-2">
                Gender, age, date of birth, race and ethnicity, national origin,
                marital status, and other demographic data
              </td>
              <td className="border border-gray-200 px-4 py-2">NO</td>
            </tr>
            <tr>
              <td className="border border-gray-200 px-4 py-2">
                D. Commercial information
              </td>
              <td className="border border-gray-200 px-4 py-2">
                Transaction information, purchase history, financial details,
                and payment information
              </td>
              <td className="border border-gray-200 px-4 py-2">NO</td>
            </tr>
            <tr>
              <td className="border border-gray-200 px-4 py-2">
                E. Biometric information
              </td>
              <td className="border border-gray-200 px-4 py-2">
                Fingerprints and voiceprints
              </td>
              <td className="border border-gray-200 px-4 py-2">NO</td>
            </tr>
            <tr>
              <td className="border border-gray-200 px-4 py-2">
                F. Internet or other similar network activity
              </td>
              <td className="border border-gray-200 px-4 py-2">
                Browsing history, search history, online behavior, interest
                data, and interactions with our and other websites,
                applications, systems, and advertisements
              </td>
              <td className="border border-gray-200 px-4 py-2">NO</td>
            </tr>
            <tr>
              <td className="border border-gray-200 px-4 py-2">
                G. Geolocation data
              </td>
              <td className="border border-gray-200 px-4 py-2">
                Device location
              </td>
              <td className="border border-gray-200 px-4 py-2">NO</td>
            </tr>
            <tr>
              <td className="border border-gray-200 px-4 py-2">
                H. Audio, electronic, sensory, or similar information
              </td>
              <td className="border border-gray-200 px-4 py-2">
                Images and audio, video or call recordings created in connection
                with our business activities
              </td>
              <td className="border border-gray-200 px-4 py-2">NO</td>
            </tr>
            <tr>
              <td className="border border-gray-200 px-4 py-2">
                I. Professional or employment-related information
              </td>
              <td className="border border-gray-200 px-4 py-2">
                Business contact details in order to provide you our Services at
                a business level or job title, work history, and professional
                qualifications if you apply for a job with us
              </td>
              <td className="border border-gray-200 px-4 py-2">NO</td>
            </tr>
            <tr>
              <td className="border border-gray-200 px-4 py-2">
                J. Education Information
              </td>
              <td className="border border-gray-200 px-4 py-2">
                Student records and directory information
              </td>
              <td className="border border-gray-200 px-4 py-2">NO</td>
            </tr>
            <tr>
              <td className="border border-gray-200 px-4 py-2">
                K. Inferences drawn from collected personal information
              </td>
              <td className="border border-gray-200 px-4 py-2">
                Inferences drawn from any of the collected personal information
                listed above to create a profile or summary about, for example,
                an individual&apos;s preferences and characteristics
              </td>
              <td className="border border-gray-200 px-4 py-2">NO</td>
            </tr>
            <tr>
              <td className="border border-gray-200 px-4 py-2">
                L. Sensitive personal Information
              </td>
              <td className="border border-gray-200 px-4 py-2">
                [No examples provided]
              </td>
              <td className="border border-gray-200 px-4 py-2">NO</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="mt-8 leading-7 not-first:mt-6">
        We may also collect other personal information outside of these
        categories through instances where you interact with us in person,
        online, or by phone or mail in the context of:
      </p>
      <ul className="my-6 ml-6 list-disc leading-7 [&>li]:mt-2">
        <li>Receiving help through our customer support channels;</li>
        <li>Participation in customer surveys or contests; and</li>
        <li>
          Facilitation in the delivery of our Services and to respond to your
          inquiries.
        </li>
      </ul>
      <p className="mt-8 leading-7 not-first:mt-6">
        We will use and retain the collected personal information as needed to
        provide the Services or for:
      </p>
      <ul className="my-6 ml-6 list-disc leading-7 [&>li]:mt-2">
        <li>Category A - As long as the user has an account with us</li>
        <li>Category B - As long as the user has an account with us</li>
        <li>Category H - As long as the user has an account with us</li>
      </ul>

      <h4 className="mt-8 scroll-m-20 text-xl font-semibold tracking-tight">
        Sources of Personal Information
      </h4>
      <p className="mt-4 leading-7 not-first:mt-6">
        Learn more about the sources of personal information we collect in
        &ldquo;WHAT INFORMATION DO WE COLLECT?&rdquo;
      </p>

      <h4 className="mt-8 scroll-m-20 text-xl font-semibold tracking-tight">
        How We Use and Share Personal Information
      </h4>
      <p className="mt-4 leading-7 not-first:mt-6">
        Learn about how we use your personal information in the section{" "}
        <a href="#section-2" className="text-blue-600 hover:underline">
          &ldquo;How do we process your information?&rdquo;
        </a>
      </p>

      <h4 className="mt-8 scroll-m-20 text-xl font-semibold tracking-tight">
        Will your information be shared with anyone else?
      </h4>
      <p className="mt-4 leading-7 not-first:mt-6">
        We may disclose your personal information with our service providers
        pursuant to a written contract between us and each service provider.
        Learn more about how we disclose personal information in the section{" "}
        <a href="#section-4" className="text-blue-600 hover:underline">
          &ldquo;When and with whom do we share your personal
          information?&rdquo;
        </a>
      </p>
      <p className="mt-8 leading-7 not-first:mt-6">
        We may use your personal information for our own business purposes, such
        as for undertaking internal research for technological development and
        demonstration. This is not considered to be &ldquo;selling&rdquo; your
        personal information.
      </p>
      <p className="mt-8 leading-7 not-first:mt-6">
        We have not disclosed, sold, or shared any personal information to third
        parties for a business or commercial purpose in the preceding twelve
        (12) months. We will not sell or share personal information in the
        future belonging to website visitors, users, and other consumers.
      </p>

      <h4 className="mt-8 scroll-m-20 text-xl font-semibold tracking-tight">
        Your Rights
      </h4>
      <p className="mt-4 leading-7 not-first:mt-6">
        You have rights under certain US state data protection laws. However,
        these rights are not absolute, and in certain cases, we may decline your
        request as permitted by law. These rights include:
      </p>
      <ul className="my-6 ml-6 list-disc leading-7 [&>li]:mt-2">
        <li>
          Right to know whether or not we are processing your personal data
        </li>
        <li>Right to access your personal data</li>
        <li>Right to correct inaccuracies in your personal data</li>
        <li>Right to request the deletion of your personal data</li>
        <li>
          Right to obtain a copy of the personal data you previously shared with
          us
        </li>
        <li>Right to non-discrimination for exercising your rights</li>
        <li>
          Right to opt out of the processing of your personal data if it is used
          for targeted advertising (or sharing as defined under
          California&apos;s privacy law), the sale of personal data, or
          profiling in furtherance of decisions that produce legal or similarly
          significant effects (&ldquo;profiling&rdquo;)
        </li>
      </ul>
      <p className="mt-8 leading-7 not-first:mt-6">
        Depending upon the state where you live, you may also have the following
        rights:
      </p>
      <ul className="my-6 ml-6 list-disc leading-7 [&>li]:mt-2">
        <li>
          Right to obtain a list of the categories of third parties to which we
          have disclosed personal data (as permitted by applicable law,
          including California&apos;s and Delaware&apos;s privacy law)
        </li>
        <li>
          Right to obtain a list of specific third parties to which we have
          disclosed personal data (as permitted by applicable law, including
          Oregon&apos;s privacy law)
        </li>
        <li>
          Right to limit use and disclosure of sensitive personal data (as
          permitted by applicable law, including California&apos;s privacy law)
        </li>
        <li>
          Right to opt out of the collection of sensitive data and personal data
          collected through the operation of a voice or facial recognition
          feature (as permitted by applicable law, including Florida&apos;s
          privacy law)
        </li>
      </ul>

      <h4 className="mt-8 scroll-m-20 text-xl font-semibold tracking-tight">
        How to Exercise Your Rights
      </h4>
      <p className="mt-4 leading-7 not-first:mt-6">
        To exercise these rights, you can contact us by referring to the contact
        details at the bottom of this document.
      </p>
      <p className="mt-8 leading-7 not-first:mt-6">
        Under certain US state data protection laws, you can designate an
        authorized agent to make a request on your behalf. We may deny a request
        from an authorized agent that does not submit proof that they have been
        validly authorized to act on your behalf in accordance with applicable
        laws.
      </p>

      <h4 className="mt-8 scroll-m-20 text-xl font-semibold tracking-tight">
        Request Verification
      </h4>
      <p className="mt-4 leading-7 not-first:mt-6">
        Upon receiving your request, we will need to verify your identity to
        determine you are the same person about whom we have the information in
        our system. We will only use personal information provided in your
        request to verify your identity or authority to make the request.
        However, if we cannot verify your identity from the information already
        maintained by us, we may request that you provide additional information
        for the purposes of verifying your identity and for security or
        fraud-prevention purposes.
      </p>
      <p className="mt-8 leading-7 not-first:mt-6">
        If you submit the request through an authorized agent, we may need to
        collect additional information to verify your identity before processing
        your request and the agent will need to provide a written and signed
        permission from you to submit such request on your behalf.
      </p>

      <h4 className="mt-8 scroll-m-20 text-xl font-semibold tracking-tight">
        Appeals
      </h4>
      <p className="mt-4 leading-7 not-first:mt-6">
        Under certain US state data protection laws, if we decline to take
        action regarding your request, you may appeal our decision by contacting
        us referring to the contact details at the bottom of this document. We
        will inform you in writing of any action taken or not taken in response
        to the appeal, including a written explanation of the reasons for the
        decisions. If your appeal is denied, you may submit a complaint to your
        state attorney general.
      </p>

      <h4 className="mt-8 scroll-m-20 text-xl font-semibold tracking-tight">
        California &ldquo;Shine The Light&rdquo; Law
      </h4>
      <p className="mt-4 leading-7 not-first:mt-6">
        California Civil Code Section 1798.83, also known as the &ldquo;Shine
        The Light&rdquo; law, permits our users who are California residents to
        request and obtain from us, once a year and free of charge, information
        about categories of personal information (if any) we disclosed to third
        parties for direct marketing purposes and the names and addresses of all
        third parties with which we shared personal information in the
        immediately preceding calendar year. If you are a California resident
        and would like to make such a request, please submit your request in
        writing to us by contacting us referring to the contact details at the
        bottom of this document.
      </p>

      <h3
        id="section-13"
        className="mt-16 scroll-m-20 text-2xl font-semibold tracking-tight"
      >
        13. Do we make updates to this notice?
      </h3>
      <p className="mt-4 leading-7 not-first:mt-6">
        <em>
          In Short: Yes, we will update this notice as necessary to stay
          compliant with relevant laws.
        </em>
      </p>
      <p className="mt-8 leading-7 not-first:mt-6">
        We may update this privacy notice from time to time. The updated version
        will be indicated by an updated &ldquo;Revised&rdquo; date at the top of
        this privacy notice. If we make material changes to this privacy notice,
        we may notify you either by prominently posting a notice of such changes
        or by directly sending you a notification. We encourage you to review
        this privacy notice frequently to be informed of how we are protecting
        your information.
      </p>

      <h3
        id="section-14"
        className="mt-16 scroll-m-20 text-2xl font-semibold tracking-tight"
      >
        14. How can you contact us about this notice?
      </h3>
      <p className="mt-4 leading-7 not-first:mt-6">
        If you have questions or comments about this notice, you may email us at{" "}
        <a
          href="mailto:privacy@askseer.ai"
          className="text-blue-600 hover:underline"
        >
          privacy@askseer.ai
        </a>
      </p>

      <h3
        id="section-15"
        className="mt-16 scroll-m-20 text-2xl font-semibold tracking-tight"
      >
        15. How can you review, update, or delete the data we collect from you?
      </h3>
      <p className="mt-4 leading-7 not-first:mt-6">
        Based on the applicable laws of your country or state of residence in
        the US, you may have the right to request access to the personal
        information we collect from you, details about how we have processed it,
        correct inaccuracies, or delete your personal information. You may also
        have the right to withdraw your consent to our processing of your
        personal information. These rights may be limited in some circumstances
        by applicable law. To request to review, update, or delete your personal
        information, please contact us.
      </p>

      <p className="mt-16 text-sm text-gray-600">
        Last updated August 10, 2024
      </p>
    </div>
  );
}
