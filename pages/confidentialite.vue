<template>
  <main class="privacy-page">
    <article class="privacy-content">
      <h1>Politique de confidentialité</h1>

      <p class="updated">
        Dernière mise à jour : 8 septembre 2026
      </p>

      <p>
        CLU (Créateur de Lignes Urbaines) est un outil permettant de créer
        des plans de lignes de transports en commun.
      </p>

      <section>
        <h2>Données enregistrées par CLU</h2>

        <p>
          CLU fonctionne principalement directement dans votre navigateur.
          Certaines données nécessaires au fonctionnement de l'application,
          notamment les préférences et les projets enregistrés localement,
          peuvent être conservées dans le stockage de votre navigateur.
        </p>
      </section>

      <section>
        <h2>Google Analytics</h2>

        <p>
          CLU utilise Google Analytics afin de mesurer l'utilisation du site
          et de mieux comprendre son audience. Ce service peut notamment
          recueillir des informations relatives à l'utilisation du site,
          telles que les pages consultées, les interactions, le type
          d'appareil et des informations géographiques approximatives.
        </p>

        <p>
          Ces informations nous permettent d'analyser la fréquentation de CLU
          et d'améliorer le service.
        </p>
      </section>

      <section>
        <h2>Google AdSense</h2>

        <p>
          CLU utilise ou pourra utiliser Google AdSense afin d'afficher des
          annonces publicitaires.
        </p>

        <p>
          Google et ses partenaires peuvent utiliser des cookies ou des
          technologies similaires afin d'afficher, mesurer et personnaliser
          des annonces, selon les choix de consentement de l'utilisateur et
          la réglementation applicable.
        </p>
      </section>

      <section>
        <h2>Cookies et consentement</h2>

        <p>
          Pour les utilisateurs concernés, notamment dans l'Espace économique
          européen, au Royaume-Uni et en Suisse, CLU utilise une plate-forme
          de gestion du consentement (CMP) de Google.
        </p>

        <p>
          Cette plate-forme permet d'accepter, de refuser ou de gérer les
          différents choix relatifs à l'utilisation des données et des
          technologies publicitaires.
        </p>
      </section>

      <section>
        <h2>Services Google</h2>

        <p>
          Pour en savoir plus sur la manière dont Google utilise les
          informations provenant de sites ou d'applications utilisant ses
          services, vous pouvez consulter les informations relatives à la
          confidentialité fournies par Google.
        </p>

        <a
          href="https://policies.google.com/technologies/partner-sites?hl=fr"
          target="_blank"
          rel="noopener noreferrer"
        >
          Comment Google utilise les informations provenant de sites utilisant ses services
        </a>
      </section>

      <section>
        <h2>Gestion des données locales</h2>

        <p>
          Les données enregistrées localement par CLU peuvent être supprimées
          en effaçant les données du site depuis les paramètres du navigateur.
        </p>
      </section>

      <section>
        <h2>Modifications</h2>

        <p>
          Cette politique de confidentialité peut être mise à jour afin de
          refléter les évolutions de CLU, des services utilisés ou des
          obligations applicables.
        </p>
      </section>

      <RouterLink class="back" to="/">
        Retour à CLU
      </RouterLink>
    </article>
  </main>
</template>

<style scoped>
.privacy-page {
  min-height: 100vh;
  padding: 3rem 1.5rem;
  background: var(--p-surface-0);
  color: var(--p-surface-900);
}

.privacy-content {
  width: min(800px, 100%);
  margin: 0 auto;
}

h1 {
  margin: 0 0 0.5rem;
  font-size: 2rem;
  line-height: 1.2;
}

.updated {
  margin-bottom: 2rem;
  color: var(--p-surface-500);
  font-size: 0.9rem;
}

section {
  margin-top: 2rem;
}

h2 {
  margin-bottom: 0.75rem;
  font-size: 1.25rem;
}

p {
  margin: 0.75rem 0;
  line-height: 1.7;
}

a {
  color: var(--p-primary-600);
  text-decoration: underline;
}

.back {
  display: inline-block;
  margin-top: 3rem;
  font-weight: 600;
}

:global(.dark-mode) .privacy-page {
  background: var(--p-surface-950);
  color: var(--p-surface-50);
}
</style>
