/**
 * The legal pages: privacy policy, terms of use and account deletion.
 *
 * They cover the website, the agency dashboard and the resident app, because
 * all three share one backend. The app stores and Google Play's data safety
 * form link here, so what these pages say must match what the code does:
 * update them whenever a new kind of data, a new provider or a new permission
 * is added.
 *
 * Kept out of the main dictionary because the text is long and only these
 * pages read it.
 */
import type { Locale } from "@/lib/i18n";

export type LegalBlock = string | { list: string[] };
export type LegalSection = { id: string; title: string; body: LegalBlock[] };
export type LegalDoc = {
  meta: { title: string; description: string };
  eyebrow: string;
  title: string;
  subtitle: string;
  updated: string;
  sections: LegalSection[];
};
export type LegalKey = "privacy" | "terms" | "deleteAccount";

export const CONTACT_EMAIL = "hello@chartahome.com";

const fr: Record<LegalKey, LegalDoc> = {
  privacy: {
    meta: {
      title: "Politique de confidentialité",
      description:
        "Les données que Charta Home collecte sur le site, le tableau de bord des agences et l'application résidents, pourquoi, avec qui elles sont partagées et comment exercer vos droits.",
    },
    eyebrow: "Confidentialité",
    title: "Politique de confidentialité",
    subtitle:
      "Ce que nous collectons, pourquoi, et ce que vous pouvez en faire. Écrit pour être lu, pas pour être signé sans lecture.",
    updated: "Dernière mise à jour : 19 octobre 2026",
    sections: [
      {
        id: "qui",
        title: "1. Qui nous sommes",
        body: [
          "Charta Home édite un logiciel de gestion immobilière pour les agences, ainsi que l'application mobile Charta Home destinée aux résidents et aux voyageurs (ensemble, « le service »). Charta Home est basée à Conakry, en République de Guinée. Vous pouvez nous écrire à hello@chartahome.com.",
          "Deux situations sont à distinguer :",
          {
            list: [
              "Les informations qu'une agence enregistre sur ses résidents (bail, loyers, paiements, réparations) sont traitées pour le compte de cette agence. L'agence en est responsable ; Charta Home agit comme sous-traitant.",
              "Votre compte dans l'application, vos réservations de courts séjours, vos demandes de location et vos paiements dans l'application sont traités par Charta Home en tant que responsable de traitement.",
            ],
          },
        ],
      },
      {
        id: "donnees",
        title: "2. Les données que nous collectons",
        body: [
          "Uniquement ce qui est nécessaire au service :",
          {
            list: [
              "Compte : nom, adresse email et mot de passe (stocké sous forme chiffrée, jamais lisible par nous). Si vous vous connectez avec Google ou Apple, nous recevons votre nom et votre adresse email de leur part. Avec « Masquer mon adresse e-mail », Apple nous transmet une adresse relais.",
              "Location : le logement, le bail, le loyer, la caution, les échéances, les paiements enregistrés et votre numéro de téléphone, tels que saisis par votre agence.",
              "Vos demandes : demandes de location (date d'entrée, durée), réservations de courts séjours (dates, nombre de nuits, montant), demandes de réparation (catégorie, description, emplacement, urgence, photos que vous choisissez d'ajouter) et messages échangés avec l'agence au sujet d'une réparation.",
              "Paiements : montant, référence, objet (loyer ou séjour), moyen (carte ou mobile money) et statut. Les numéros de carte et de mobile money sont saisis sur la page sécurisée de PayUnit, notre prestataire de paiement : nous ne les recevons jamais.",
              "Appareil : système (iOS ou Android), langue, jeton de notification si vous les activez, et vos préférences (langue, rester connecté) enregistrées sur votre téléphone.",
              "Journaux techniques : adresse IP, date et heure des requêtes et erreurs, conservés par nos hébergeurs pour la sécurité et le bon fonctionnement.",
              "Agences : pour les utilisateurs du tableau de bord, les informations de l'agence, des immeubles, du personnel et de l'abonnement.",
            ],
          },
          "Nous ne collectons pas votre position, vos contacts, vos fichiers en dehors des photos que vous choisissez, ni d'identifiant publicitaire. Il n'y a ni publicité, ni pistage entre applications ou sites, ni outil d'analyse tiers dans l'application. Nous ne vendons pas vos données.",
        ],
      },
      {
        id: "permissions",
        title: "3. Les autorisations de l'application",
        body: [
          {
            list: [
              "Appareil photo et photos : uniquement lorsque vous ajoutez des photos à une demande de réparation. Seules les photos choisies sont envoyées.",
              "Notifications : facultatives. Elles servent aux rappels de loyer, au suivi des réparations et aux confirmations de réservation. Vous pouvez les désactiver dans l'application ou dans les réglages du téléphone.",
              "Internet : pour communiquer avec nos serveurs.",
            ],
          },
          "La carte d'un logement montre l'emplacement fourni par l'agence. Elle n'utilise pas la position de votre téléphone.",
        ],
      },
      {
        id: "finalites",
        title: "4. Pourquoi nous les utilisons",
        body: [
          {
            list: [
              "Fournir le service : créer et sécuriser votre compte, afficher votre logement, vos échéances et vos reçus, transmettre vos demandes à l'agence, réserver un séjour (exécution du contrat).",
              "Encaisser et confirmer les paiements, envoyer les reçus par email (exécution du contrat).",
              "Vous prévenir : rappels de loyer, mises à jour de réparation et confirmations, par notification, email, WhatsApp ou SMS selon les choix de votre agence (exécution du contrat et intérêt légitime).",
              "Protéger le service : prévenir la fraude, les abus et les accès non autorisés (intérêt légitime).",
              "Respecter nos obligations légales, notamment comptables et fiscales.",
            ],
          },
          "Nous n'utilisons pas vos données pour de la publicité, ni pour prendre des décisions automatisées qui produisent des effets juridiques à votre égard.",
        ],
      },
      {
        id: "partage",
        title: "5. Avec qui elles sont partagées",
        body: [
          "Votre agence voit les informations liées à votre logement, vos paiements, vos demandes et vos réservations chez elle. Une agence ne voit jamais les données liées à une autre agence.",
          "Nous faisons appel à des prestataires qui traitent les données uniquement pour notre compte :",
          {
            list: [
              "Supabase : base de données, authentification et stockage des photos.",
              "Vercel : hébergement du site et des serveurs de l'application.",
              "PayUnit : paiements par carte et mobile money (MTN MoMo, Orange Money).",
              "Resend : envoi des emails (confirmation de compte, codes, reçus).",
              "Meta (WhatsApp Business) : messages WhatsApp envoyés par votre agence, lorsqu'elle les utilise.",
              "Google et Apple : connexion avec votre compte Google ou Apple, si vous la choisissez, et distribution des notifications.",
              "OpenStreetMap et Google Fonts : affichage des cartes et des polices. Ces services reçoivent l'adresse IP de votre appareil lorsqu'ils sont chargés.",
            ],
          },
          "Nous pouvons aussi communiquer des données lorsque la loi l'exige, ou en cas de rachat ou de fusion de Charta Home, avec les mêmes garanties.",
        ],
      },
      {
        id: "transferts",
        title: "6. Transferts hors de votre pays",
        body: [
          "Certains prestataires stockent ou traitent les données hors de Guinée et de la zone CEMAC, notamment dans l'Union européenne et aux États-Unis. Nous choisissons des prestataires qui s'engagent contractuellement à protéger les données et à ne les utiliser que pour nous.",
        ],
      },
      {
        id: "conservation",
        title: "7. Durée de conservation",
        body: [
          {
            list: [
              "Compte : tant qu'il est actif. Après une suppression, il est effacé sous 30 jours.",
              "Paiements, baux et loyers : conservés par l'agence pendant la durée imposée par la loi comptable et fiscale, y compris après la suppression de votre compte.",
              "Demandes de réparation et leurs photos : conservées dans le dossier du logement de l'agence, sans lien avec votre compte supprimé.",
              "Jetons de notification : supprimés avec le compte ou dès qu'ils ne sont plus valides.",
              "Journaux techniques : quelques semaines.",
            ],
          },
        ],
      },
      {
        id: "securite",
        title: "8. Sécurité",
        body: [
          "Les échanges sont chiffrés (HTTPS). Les mots de passe sont stockés sous forme chiffrée. Des règles d'accès au niveau de la base de données limitent chaque résident à ses propres informations et chaque agence à ses propres données. Les clés secrètes (paiement, email) restent sur nos serveurs et ne sont jamais dans l'application. Aucun système n'est infaillible : en cas d'incident touchant vos données, nous vous en informerons ainsi que les autorités lorsque la loi l'exige.",
        ],
      },
      {
        id: "droits",
        title: "9. Vos droits",
        body: [
          "Vous pouvez demander l'accès à vos données, leur rectification, leur suppression ou une copie, et vous opposer à certains traitements. Vous pouvez supprimer votre compte vous-même dans l'application (Profil › Supprimer mon compte) ou suivre les étapes de la page « Supprimer mon compte ».",
          "Pour les informations enregistrées par votre agence, adressez-vous à elle ou écrivez-nous : nous transmettrons. Nous répondons sous 30 jours au plus. Vous pouvez aussi saisir l'autorité de protection des données de votre pays.",
        ],
      },
      {
        id: "mineurs",
        title: "10. Mineurs",
        body: [
          "Le service est destiné aux personnes majeures. Nous ne collectons pas sciemment de données sur des mineurs. Si vous pensez qu'un mineur nous a transmis des données, écrivez-nous et nous les supprimerons.",
        ],
      },
      {
        id: "modifications",
        title: "11. Modifications",
        body: [
          "Nous mettrons cette politique à jour quand le service évolue. La date en haut de la page indique la dernière version. En cas de changement important, nous vous préviendrons dans l'application ou par email.",
        ],
      },
      {
        id: "contact",
        title: "12. Nous contacter",
        body: ["Charta Home, Conakry, République de Guinée. Email : hello@chartahome.com."],
      },
    ],
  },

  terms: {
    meta: {
      title: "Conditions d'utilisation",
      description:
        "Les règles d'utilisation de Charta Home : le site, le tableau de bord des agences et l'application résidents.",
    },
    eyebrow: "Conditions",
    title: "Conditions d'utilisation",
    subtitle: "Les règles qui s'appliquent quand vous utilisez Charta Home, sur le web ou dans l'application.",
    updated: "Dernière mise à jour : 19 octobre 2026",
    sections: [
      {
        id: "objet",
        title: "1. Le service",
        body: [
          "Charta Home permet aux agences immobilières de gérer leurs immeubles, leurs loyers et leurs réparations, et aux résidents de consulter leur logement, payer leur loyer, signaler une réparation, demander une location ou réserver un court séjour depuis l'application. En créant un compte ou en utilisant le service, vous acceptez ces conditions et notre politique de confidentialité.",
        ],
      },
      {
        id: "compte",
        title: "2. Votre compte",
        body: [
          {
            list: [
              "Vous devez être majeur et fournir des informations exactes.",
              "Vous êtes responsable de la confidentialité de votre mot de passe et de ce qui est fait depuis votre compte. Prévenez-nous sans délai en cas d'utilisation non autorisée.",
              "Votre compte résident est relié à votre logement lorsque votre agence a enregistré la même adresse email.",
              "Vous pouvez supprimer votre compte à tout moment depuis l'application.",
            ],
          },
        ],
      },
      {
        id: "agences",
        title: "3. Le rôle des agences",
        body: [
          "Les logements, prix, disponibilités, baux et décisions de location sont fixés par les agences, pas par Charta Home. Une demande de location n'est pas un contrat : l'agence vous recontacte pour la confirmer. Le bail que vous signez avec l'agence ou le propriétaire prime sur ces conditions pour tout ce qui concerne la location elle-même. Charta Home n'est ni propriétaire, ni bailleur, ni agent immobilier.",
          "Les informations affichées (photos, surface, équipements, emplacement) sont fournies par l'agence. Nous faisons de notre mieux pour que le service soit fiable, mais nous ne garantissons pas leur exactitude.",
        ],
      },
      {
        id: "paiements",
        title: "4. Paiements",
        body: [
          {
            list: [
              "Les paiements sont traités par PayUnit, par carte ou mobile money. Les conditions de PayUnit et de votre opérateur s'appliquent aussi.",
              "Le montant est calculé par nos serveurs à partir des loyers dus ou du séjour réservé. Le reçu est envoyé par email une fois le paiement confirmé par PayUnit.",
              "Payer un loyer à l'avance est possible ; le paiement est affecté aux échéances les plus anciennes d'abord.",
              "Les remboursements, cautions et litiges sur un loyer relèvent de votre agence et de votre bail. Contactez l'agence d'abord ; nous vous aiderons si besoin.",
            ],
          },
        ],
      },
      {
        id: "sejours",
        title: "5. Courts séjours",
        body: [
          "Le prix d'un séjour dépend du nombre de nuits et des forfaits fixés par l'agence ; il est affiché avant le paiement. Les dates sont bloquées 15 minutes pendant le paiement, puis libérées si le paiement n'aboutit pas. Une réservation est confirmée une fois payée. L'annulation et le remboursement suivent les règles de l'agence, qui vous les communique.",
        ],
      },
      {
        id: "usage",
        title: "6. Utilisation acceptable",
        body: [
          "Vous vous engagez à ne pas :",
          {
            list: [
              "fournir de fausses informations ou vous faire passer pour quelqu'un d'autre ;",
              "envoyer des contenus illicites, offensants ou qui portent atteinte aux droits d'autrui, notamment dans les photos et messages ;",
              "tenter d'accéder aux données d'autres utilisateurs, de contourner la sécurité ou de perturber le service ;",
              "copier, revendre ou extraire le service ou son contenu de façon automatisée.",
            ],
          },
          "Nous pouvons suspendre un compte qui ne respecte pas ces règles.",
        ],
      },
      {
        id: "pi",
        title: "7. Propriété intellectuelle",
        body: [
          "Le logiciel, la marque Charta Home et le design appartiennent à Charta Home. Vous conservez vos droits sur les photos et textes que vous envoyez et nous autorisez à les utiliser uniquement pour fournir le service.",
        ],
      },
      {
        id: "responsabilite",
        title: "8. Disponibilité et responsabilité",
        body: [
          "Nous faisons de notre mieux pour que le service soit disponible et sans erreur, mais il peut être interrompu pour maintenance ou en raison de prestataires tiers (paiement, réseau, opérateurs). Dans les limites permises par la loi, Charta Home n'est pas responsable des pertes indirectes, ni des engagements pris entre vous et une agence.",
        ],
      },
      {
        id: "fin",
        title: "9. Fin d'utilisation",
        body: [
          "Vous pouvez cesser d'utiliser le service et supprimer votre compte à tout moment. Les informations que l'agence doit conserver (paiements, bail) restent chez elle comme décrit dans la politique de confidentialité.",
        ],
      },
      {
        id: "loi",
        title: "10. Droit applicable",
        body: [
          "Ces conditions sont régies par le droit de la République de Guinée, sans priver les consommateurs des protections impératives de leur pays de résidence. En cas de différend, écrivez-nous d'abord : nous chercherons une solution amiable.",
        ],
      },
      {
        id: "modifs",
        title: "11. Modifications et contact",
        body: [
          "Nous pouvons modifier ces conditions ; la date en haut de la page indique la version en vigueur et nous vous préviendrons des changements importants. Questions : hello@chartahome.com.",
        ],
      },
    ],
  },

  deleteAccount: {
    meta: {
      title: "Supprimer mon compte",
      description: "Comment supprimer votre compte Charta Home et vos données, depuis l'application ou par email.",
    },
    eyebrow: "Vos données",
    title: "Supprimer mon compte",
    subtitle: "Supprimez votre compte de l'application Charta Home, avec ou sans l'application installée.",
    updated: "Dernière mise à jour : 19 octobre 2026",
    sections: [
      {
        id: "app",
        title: "Depuis l'application",
        body: [
          {
            list: [
              "Ouvrez l'application Charta Home et connectez-vous.",
              "Allez dans Profil, puis touchez « Supprimer mon compte ».",
              "Confirmez. Vous êtes déconnecté et votre compte est supprimé immédiatement.",
            ],
          },
        ],
      },
      {
        id: "email",
        title: "Sans l'application",
        body: [
          "Écrivez à hello@chartahome.com depuis l'adresse email de votre compte, avec pour objet « Suppression de compte ». Nous confirmons la suppression sous 30 jours au plus. Si vous écrivez depuis une autre adresse, nous vous demanderons de prouver que le compte vous appartient.",
        ],
      },
      {
        id: "supprime",
        title: "Ce qui est supprimé",
        body: [
          {
            list: [
              "Votre compte : nom, adresse email, mot de passe et connexions Google ou Apple.",
              "Vos appareils enregistrés et jetons de notification.",
              "Vos demandes de location.",
              "Le lien entre votre compte et votre dossier chez l'agence.",
            ],
          },
        ],
      },
      {
        id: "conserve",
        title: "Ce qui est conservé, et pourquoi",
        body: [
          {
            list: [
              "Les paiements, reçus, baux et loyers : votre agence doit les conserver pendant la durée imposée par la loi comptable et fiscale. Ils ne sont plus reliés à votre compte.",
              "Les réservations de séjours payées et les demandes de réparation, avec leurs photos : elles restent dans le dossier du logement de l'agence, sans lien avec votre compte.",
              "Les journaux techniques, pendant quelques semaines, pour la sécurité.",
            ],
          },
          "Pour que l'agence efface aussi ce qu'elle détient, contactez-la directement : elle reste responsable de son dossier de location.",
        ],
      },
      {
        id: "agence",
        title: "Vous êtes une agence ?",
        body: [
          "Les comptes du tableau de bord ne se suppriment pas depuis l'application. Écrivez-nous à hello@chartahome.com depuis l'adresse du propriétaire de l'agence.",
        ],
      },
    ],
  },
};

const en: Record<LegalKey, LegalDoc> = {
  privacy: {
    meta: {
      title: "Privacy policy",
      description:
        "What data Charta Home collects on the website, the agency dashboard and the resident app, why, who it is shared with and how to use your rights.",
    },
    eyebrow: "Privacy",
    title: "Privacy policy",
    subtitle: "What we collect, why, and what you can do about it. Written to be read, not just agreed to.",
    updated: "Last updated: 19 October 2026",
    sections: [
      {
        id: "who",
        title: "1. Who we are",
        body: [
          "Charta Home makes property management software for real estate agencies, and the Charta Home mobile app for residents and guests (together, \"the service\"). Charta Home is based in Conakry, Republic of Guinea. You can write to us at hello@chartahome.com.",
          "There are two situations:",
          {
            list: [
              "Information an agency records about its residents (lease, rent, payments, repairs) is processed on behalf of that agency. The agency is responsible for it; Charta Home acts as its processor.",
              "Your app account, your short-stay bookings, your rental requests and your in-app payments are processed by Charta Home as controller.",
            ],
          },
        ],
      },
      {
        id: "data",
        title: "2. The data we collect",
        body: [
          "Only what the service needs:",
          {
            list: [
              "Account: name, email address and password (stored hashed, never readable by us). If you sign in with Google or Apple, we receive your name and email address from them. With \"Hide My Email\", Apple gives us a relay address.",
              "Tenancy: your home, lease, rent, deposit, due dates, recorded payments and phone number, as entered by your agency.",
              "Your requests: rental requests (move-in date, length), short-stay bookings (dates, nights, amount), repair requests (category, description, location, urgency, photos you choose to add) and messages with the agency about a repair.",
              "Payments: amount, reference, purpose (rent or stay), method (card or mobile money) and status. Card and mobile money numbers are entered on the secure page of PayUnit, our payment provider: we never receive them.",
              "Device: operating system (iOS or Android), language, notification token if you turn notifications on, and your preferences (language, keep me signed in) saved on your phone.",
              "Technical logs: IP address, time of requests and errors, kept by our hosting providers for security and reliability.",
              "Agencies: for dashboard users, information about the agency, its buildings, staff and subscription.",
            ],
          },
          "We do not collect your location, contacts, files other than the photos you pick, or any advertising identifier. There are no ads, no tracking across apps or websites and no third-party analytics in the app. We do not sell your data.",
        ],
      },
      {
        id: "permissions",
        title: "3. App permissions",
        body: [
          {
            list: [
              "Camera and photos: only when you add photos to a repair request. Only the photos you pick are uploaded.",
              "Notifications: optional. Used for rent reminders, repair updates and booking confirmations. Turn them off in the app or in your phone's settings.",
              "Internet: to talk to our servers.",
            ],
          },
          "The map on a home shows the location given by the agency. It does not use your phone's location.",
        ],
      },
      {
        id: "purposes",
        title: "4. Why we use it",
        body: [
          {
            list: [
              "To provide the service: create and secure your account, show your home, due dates and receipts, pass your requests to the agency, book a stay (performance of a contract).",
              "To take and confirm payments and email receipts (performance of a contract).",
              "To keep you informed: rent reminders, repair updates and confirmations, by notification, email, WhatsApp or SMS depending on your agency's choices (contract and legitimate interest).",
              "To protect the service: prevent fraud, abuse and unauthorised access (legitimate interest).",
              "To meet our legal obligations, including accounting and tax.",
            ],
          },
          "We do not use your data for advertising, or for automated decisions with legal effects on you.",
        ],
      },
      {
        id: "sharing",
        title: "5. Who we share it with",
        body: [
          "Your agency sees the information about your home, payments, requests and bookings with that agency. An agency never sees data that belongs to another agency.",
          "We use providers that process data only on our behalf:",
          {
            list: [
              "Supabase: database, sign-in and photo storage.",
              "Vercel: hosting for the website and the app's servers.",
              "PayUnit: card and mobile money payments (MTN MoMo, Orange Money).",
              "Resend: email delivery (account confirmation, codes, receipts).",
              "Meta (WhatsApp Business): WhatsApp messages sent by your agency, when it uses them.",
              "Google and Apple: sign-in with your Google or Apple account, if you choose it, and notification delivery.",
              "OpenStreetMap and Google Fonts: maps and fonts. These services receive your device's IP address when they load.",
            ],
          },
          "We may also disclose data when the law requires it, or if Charta Home is acquired or merged, with the same protections.",
        ],
      },
      {
        id: "transfers",
        title: "6. International transfers",
        body: [
          "Some providers store or process data outside Guinea and the CEMAC zone, including in the European Union and the United States. We choose providers that commit by contract to protect the data and use it only for us.",
        ],
      },
      {
        id: "retention",
        title: "7. How long we keep it",
        body: [
          {
            list: [
              "Account: while it is active. After you delete it, it is erased within 30 days.",
              "Payments, leases and rent: kept by the agency for as long as accounting and tax law require, including after your account is deleted.",
              "Repair requests and their photos: kept in the agency's record for the home, no longer linked to your deleted account.",
              "Notification tokens: deleted with the account or as soon as they stop working.",
              "Technical logs: a few weeks.",
            ],
          },
        ],
      },
      {
        id: "security",
        title: "8. Security",
        body: [
          "Traffic is encrypted (HTTPS). Passwords are stored hashed. Database access rules limit each resident to their own information and each agency to its own data. Secret keys (payments, email) stay on our servers and are never in the app. No system is perfect: if an incident affects your data, we will tell you, and the authorities when the law requires it.",
        ],
      },
      {
        id: "rights",
        title: "9. Your rights",
        body: [
          "You can ask to access, correct, delete or get a copy of your data, and object to some processing. You can delete your account yourself in the app (Profile › Delete my account) or follow the steps on the \"Delete my account\" page.",
          "For information recorded by your agency, contact the agency or write to us and we will pass it on. We reply within 30 days at most. You can also complain to the data protection authority in your country.",
        ],
      },
      {
        id: "children",
        title: "10. Children",
        body: [
          "The service is meant for adults. We do not knowingly collect data from minors. If you think a minor has sent us data, write to us and we will delete it.",
        ],
      },
      {
        id: "changes",
        title: "11. Changes",
        body: [
          "We will update this policy as the service changes. The date at the top shows the latest version. If a change is significant, we will tell you in the app or by email.",
        ],
      },
      {
        id: "contact",
        title: "12. Contact us",
        body: ["Charta Home, Conakry, Republic of Guinea. Email: hello@chartahome.com."],
      },
    ],
  },

  terms: {
    meta: {
      title: "Terms of use",
      description: "The rules for using Charta Home: the website, the agency dashboard and the resident app.",
    },
    eyebrow: "Terms",
    title: "Terms of use",
    subtitle: "The rules that apply when you use Charta Home, on the web or in the app.",
    updated: "Last updated: 19 October 2026",
    sections: [
      {
        id: "service",
        title: "1. The service",
        body: [
          "Charta Home lets real estate agencies manage their buildings, rent and repairs, and lets residents see their home, pay rent, report repairs, request a rental or book a short stay from the app. By creating an account or using the service, you accept these terms and our privacy policy.",
        ],
      },
      {
        id: "account",
        title: "2. Your account",
        body: [
          {
            list: [
              "You must be an adult and give accurate information.",
              "You are responsible for keeping your password safe and for what happens in your account. Tell us at once about any unauthorised use.",
              "Your resident account is linked to your home when your agency has recorded the same email address.",
              "You can delete your account at any time from the app.",
            ],
          },
        ],
      },
      {
        id: "agencies",
        title: "3. The agencies' role",
        body: [
          "Homes, prices, availability, leases and rental decisions are set by the agencies, not by Charta Home. A rental request is not a contract: the agency contacts you to confirm it. The lease you sign with the agency or landlord prevails over these terms for anything about the tenancy itself. Charta Home is not a landlord, owner or estate agent.",
          "Listing details (photos, size, amenities, location) come from the agency. We do our best to keep the service reliable but cannot guarantee they are accurate.",
        ],
      },
      {
        id: "payments",
        title: "4. Payments",
        body: [
          {
            list: [
              "Payments are processed by PayUnit, by card or mobile money. PayUnit's and your operator's terms also apply.",
              "The amount is computed by our servers from the rent due or the stay booked. The receipt is emailed once PayUnit confirms the payment.",
              "You can pay rent in advance; a payment is applied to the oldest charges first.",
              "Refunds, deposits and rent disputes are between you and your agency under your lease. Contact the agency first; we will help if needed.",
            ],
          },
        ],
      },
      {
        id: "stays",
        title: "5. Short stays",
        body: [
          "A stay's price depends on the number of nights and the packages set by the agency, and is shown before you pay. Dates are held for 15 minutes while you pay, then released if the payment does not go through. A booking is confirmed once paid. Cancellations and refunds follow the agency's rules, which it shares with you.",
        ],
      },
      {
        id: "use",
        title: "6. Acceptable use",
        body: [
          "You agree not to:",
          {
            list: [
              "give false information or pretend to be someone else;",
              "send unlawful or offensive content, or content that infringes other people's rights, including in photos and messages;",
              "try to access other users' data, get around security or disrupt the service;",
              "copy, resell or scrape the service or its content.",
            ],
          },
          "We may suspend an account that breaks these rules.",
        ],
      },
      {
        id: "ip",
        title: "7. Intellectual property",
        body: [
          "The software, the Charta Home brand and the design belong to Charta Home. You keep your rights in the photos and text you send and allow us to use them only to provide the service.",
        ],
      },
      {
        id: "liability",
        title: "8. Availability and liability",
        body: [
          "We do our best to keep the service available and error free, but it can be interrupted for maintenance or because of third parties (payments, network, operators). To the extent the law allows, Charta Home is not liable for indirect losses or for commitments between you and an agency.",
        ],
      },
      {
        id: "ending",
        title: "9. Ending",
        body: [
          "You can stop using the service and delete your account at any time. Information the agency must keep (payments, lease) stays with it as described in the privacy policy.",
        ],
      },
      {
        id: "law",
        title: "10. Governing law",
        body: [
          "These terms are governed by the law of the Republic of Guinea, without removing any mandatory consumer protection of your country of residence. If there is a dispute, write to us first and we will look for an amicable solution.",
        ],
      },
      {
        id: "updates",
        title: "11. Changes and contact",
        body: [
          "We may change these terms; the date at the top shows the version in force and we will tell you about significant changes. Questions: hello@chartahome.com.",
        ],
      },
    ],
  },

  deleteAccount: {
    meta: {
      title: "Delete my account",
      description: "How to delete your Charta Home account and data, from the app or by email.",
    },
    eyebrow: "Your data",
    title: "Delete my account",
    subtitle: "Delete your Charta Home app account, with or without the app installed.",
    updated: "Last updated: 19 October 2026",
    sections: [
      {
        id: "app",
        title: "From the app",
        body: [
          {
            list: [
              "Open the Charta Home app and sign in.",
              "Go to Profile, then tap \"Delete my account\".",
              "Confirm. You are signed out and your account is deleted straight away.",
            ],
          },
        ],
      },
      {
        id: "email",
        title: "Without the app",
        body: [
          "Email hello@chartahome.com from your account's email address with the subject \"Account deletion\". We confirm the deletion within 30 days at most. If you write from another address, we will ask you to prove the account is yours.",
        ],
      },
      {
        id: "deleted",
        title: "What is deleted",
        body: [
          {
            list: [
              "Your account: name, email address, password and Google or Apple sign-in.",
              "Your registered devices and notification tokens.",
              "Your rental requests.",
              "The link between your account and your record with the agency.",
            ],
          },
        ],
      },
      {
        id: "kept",
        title: "What is kept, and why",
        body: [
          {
            list: [
              "Payments, receipts, leases and rent: your agency must keep them for as long as accounting and tax law require. They are no longer linked to your account.",
              "Paid stay bookings and repair requests, with their photos: they stay in the agency's record for the home, no longer linked to your account.",
              "Technical logs, for a few weeks, for security.",
            ],
          },
          "To have the agency erase what it holds as well, contact it directly: it remains responsible for its tenancy records.",
        ],
      },
      {
        id: "agency",
        title: "Are you an agency?",
        body: [
          "Dashboard accounts cannot be deleted from the app. Write to hello@chartahome.com from the agency owner's address.",
        ],
      },
    ],
  },
};

export function legalDoc(locale: Locale | string, key: LegalKey): LegalDoc {
  return (locale === "en" ? en : fr)[key];
}
