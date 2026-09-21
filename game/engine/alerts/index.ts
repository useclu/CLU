import { currentGameLocaleTag } from '../../config/i18n'
import type { GameInfoItem } from '../../types/alerts'
import type { GameSave } from '../../types/game'

export function buildGameInfoItems(save: GameSave): GameInfoItem[] {
  const day = save.data.simulationDay
  const history = save.data.simulation.history
  const report = history.at(-1)
  const previousReport = history.length > 1 ? history.at(-2) : null
  const recentReports = history.slice(-3)
  const operationalReports = history.filter(item => (item.lines?.length ?? 0) > 0)
  const networkWarmup = operationalReports.length > 0 && operationalReports.length <= 2
  const items: GameInfoItem[] = []

  for (const line of save.data.network.lines) {
    if (line.status === 'CONSTRUCTION') {
      items.push({
        id: `construction:${line.id}`,
        day,
        severity: 'INFO',
        category: 'NETWORK',
        title: `${line.name} est en travaux`,
        description: `${line.constructionDaysRemaining} jour(s) avant mise en service estimée.`,
        lineId: line.id,
      })
    }
  }

  if (report) {
    if (!networkWarmup && report.lines.length >= 2 && (report.demandSatisfactionRate ?? 1) < 0.86 && (report.boardingDemandPassengers ?? 0) > 500) {
      items.push({
        id: 'network:demand-satisfaction',
        day,
        severity: (report.demandSatisfactionRate ?? 1) < 0.70 ? 'CRITICAL' : 'WARNING',
        category: 'PASSENGERS',
        title: 'Une partie de la demande reste sans solution',
        description: `${Math.round((report.demandSatisfactionRate ?? 1) * 100)} % de la demande du réseau est transportée. ${report.waitingPassengers.toLocaleString(currentGameLocaleTag())} voyageurs attendent encore et ${report.lostPassengers.toLocaleString(currentGameLocaleTag())} ont renoncé aujourd’hui.`,
      })
    }

    if (recentReports.length >= 3) {
      const [first, middle, last] = recentReports
      if (first && middle && last
        && first.waitingPassengers > 350
        && middle.waitingPassengers > first.waitingPassengers * 1.08
        && last.waitingPassengers > middle.waitingPassengers * 1.08) {
        items.push({
          id: 'network:queue-trend',
          day,
          severity: last.waitingPassengers > 8_000 ? 'CRITICAL' : 'WARNING',
          category: 'PASSENGERS',
          title: 'Les files d’attente progressent depuis plusieurs jours',
          description: `Elles sont passées de ${first.waitingPassengers.toLocaleString(currentGameLocaleTag())} à ${last.waitingPassengers.toLocaleString(currentGameLocaleTag())} voyageurs en trois journées. La tendance devient structurelle.`,
        })
      }
    }

    if (previousReport) {
      const satisfactionGain = (report.demandSatisfactionRate ?? 1) - (previousReport.demandSatisfactionRate ?? 1)
      const waitingDrop = previousReport.waitingPassengers > 0
        ? 1 - report.waitingPassengers / previousReport.waitingPassengers
        : 0
      if (satisfactionGain >= 0.08 || (waitingDrop >= 0.35 && previousReport.waitingPassengers >= 800)) {
        items.push({
          id: 'network:recovery',
          day,
          severity: 'INFO',
          category: 'PASSENGERS',
          title: 'Le réseau absorbe mieux la demande',
          description: `La satisfaction de la demande atteint ${Math.round((report.demandSatisfactionRate ?? 1) * 100)} % et les files d’attente évoluent dans le bon sens.`,
        })
      }
    }

    if ((report.serviceQualityScore ?? 0) >= 82
      && (report.networkMoraleScore ?? 0) >= 74
      && (report.demandSatisfactionRate ?? 0) >= 0.96
      && report.waitingPassengers < Math.max(250, report.passengers * 0.015)) {
      items.push({
        id: 'network:healthy-day',
        day,
        severity: 'INFO',
        category: 'NETWORK',
        title: 'Journée bien maîtrisée',
        description: `Qualité ${Math.round(report.serviceQualityScore ?? 0)}/100 · moral ${Math.round(report.networkMoraleScore ?? 0)}/100 · ${Math.round((report.demandSatisfactionRate ?? 1) * 100)} % de la demande transportée.`,
      })
    }

    for (const line of report.lines) {
      const runtime = save.data.simulation.lineStates.find(state => state.lineId === line.lineId)
      const previousLine = previousReport?.lines.find(item => item.lineId === line.lineId)

      const lineOperationalDays = history.filter(dayReport => dayReport.lines.some(item => item.lineId === line.lineId)).length
      if (lineOperationalDays <= 2) {
        const startupNeedsAdjustment = (line.serviceFulfillmentRate ?? 1) < 0.92
          || (line.waitingPassengersAfter ?? 0) > 500
          || (line.demandSatisfactionRate ?? 1) < 0.90
        if (startupNeedsAdjustment) {
          items.push({
            id: `startup:${line.lineId}`,
            day,
            severity: 'INFO',
            category: 'NETWORK',
            title: `Mise en route de ${line.lineName}`,
            description: `CLU observe encore les deux premières journées d’exploitation de cette ligne avant de déclencher une alerte forte. Service produit : ${Math.round((line.serviceFulfillmentRate ?? 0) * 100)} %. Si la tension persiste, vérifiez d’abord le parc et le niveau de service.`,
            lineId: line.lineId,
          })
        }
        continue
      }

      if ((line.departuresPerHour ?? 0) <= 0 && line.boardingDemandPassengers > 0) {
        items.push({
          id: `stopped:${line.lineId}`,
          day,
          severity: 'CRITICAL',
          category: 'NETWORK',
          title: `Aucun service sur ${line.lineName}`,
          description: `${line.boardingDemandPassengers.toLocaleString(currentGameLocaleTag())} voyageurs souhaitent utiliser la ligne, mais aucun passage n'est assuré. Vérifiez le parc disponible et le niveau de service.`,
          lineId: line.lineId,
        })
      }

      if ((line.demandSatisfactionRate ?? 1) < 0.74 && line.boardingDemandPassengers >= 300) {
        items.push({
          id: `unserved:${line.lineId}`,
          day,
          severity: (line.demandSatisfactionRate ?? 1) < 0.55 ? 'CRITICAL' : 'WARNING',
          category: 'PASSENGERS',
          title: `Demande mal absorbée sur ${line.lineName}`,
          description: `${Math.round((line.demandSatisfactionRate ?? 0) * 100)} % des voyageurs souhaitant partir ont été transportés. Attente moyenne estimée : ${Math.round(line.averageWaitMinutes ?? 0)} min.`,
          lineId: line.lineId,
        })
      }

      if (line.waitingPassengersAfter > 1_000) {
        items.push({
          id: `queue:${line.lineId}`,
          day,
          severity: line.waitingPassengersAfter > 8_000 ? 'CRITICAL' : 'WARNING',
          category: 'PASSENGERS',
          title: `Files d’attente sur ${line.lineName}`,
          description: `${line.waitingPassengersAfter.toLocaleString(currentGameLocaleTag())} voyageurs attendent encore. ${line.lostPassengers.toLocaleString(currentGameLocaleTag())} ont renoncé à voyager aujourd’hui. Attente moyenne estimée : ${Math.round(line.averageWaitMinutes ?? 0)} min.`,
          lineId: line.lineId,
        })
      }

      if (previousLine
        && line.waitingPassengersAfter > previousLine.waitingPassengersAfter * 1.25
        && line.waitingPassengersAfter - previousLine.waitingPassengersAfter >= 300) {
        items.push({
          id: `queue-rise:${line.lineId}`,
          day,
          severity: 'WARNING',
          category: 'PASSENGERS',
          title: `La file d’attente augmente sur ${line.lineName}`,
          description: `${(line.waitingPassengersAfter - previousLine.waitingPassengersAfter).toLocaleString(currentGameLocaleTag())} voyageurs supplémentaires restent en attente par rapport à la veille.`,
          lineId: line.lineId,
        })
      }

      if ((line.serviceFulfillmentRate ?? 1) < 0.82) {
        items.push({
          id: `service:${line.lineId}`,
          day,
          severity: 'WARNING',
          category: 'NETWORK',
          title: `Service non assuré sur ${line.lineName}`,
          description: `Seulement ${Math.round((line.serviceFulfillmentRate ?? 0) * 100)} % du service demandé est réellement produit.`,
          lineId: line.lineId,
        })
      }

      if ((line.regularityScore ?? 100) < 70) {
        items.push({
          id: `regularity:${line.lineId}`,
          day,
          severity: (line.regularityScore ?? 100) < 50 ? 'CRITICAL' : 'WARNING',
          category: 'NETWORK',
          title: `Régularité faible sur ${line.lineName}`,
          description: `Régularité ${Math.round(line.regularityScore ?? 0)}/100 · réserve ${line.reserveVehicleCount ?? 0} véhicule(s) · renfort ${line.activeBoostVehicleCount ?? 0}. ${line.regulationMode === 'AUTO' ? 'La régulation automatique essaie de lisser les intervalles.' : 'Un renfort manuel ou le mode Auto peut améliorer les intervalles.'}`,
          lineId: line.lineId,
        })
      }

      if ((line.fleetConditionAfter ?? line.fleetCondition ?? 100) < 65) {
        items.push({
          id: `fleet:${line.lineId}`,
          day,
          severity: 'CRITICAL',
          category: 'MAINTENANCE',
          title: `Parc dégradé sur ${line.lineName}`,
          description: `État du parc : ${Math.round(line.fleetConditionAfter ?? line.fleetCondition ?? 0)} %. Le niveau de maintenance devient un risque opérationnel.`,
          lineId: line.lineId,
        })
      }

      if ((line.congestedStationCount ?? 0) > 0) {
        const busiestStation = [...(line.stations ?? [])].sort((a, b) => b.utilizationRate - a.utilizationRate)[0]
        items.push({
          id: `station:${line.lineId}`,
          day,
          severity: (busiestStation?.utilizationRate ?? 0) >= 1.25 ? 'CRITICAL' : 'WARNING',
          category: 'STATION',
          title: `Station(s) saturée(s) sur ${line.lineName}`,
          description: `${line.congestedStationCount} station(s) dépassent leur capacité de confort. Point le plus chargé : ${line.busiestStationName ?? 'inconnu'}${busiestStation ? ` (${Math.round(busiestStation.utilizationRate * 100)} %)` : ''}.`,
          lineId: line.lineId,
          stationId: busiestStation?.stationId,
        })
      }

      if (line.moraleScoreAfter < 52) {
        items.push({
          id: `morale:${line.lineId}`,
          day,
          severity: 'WARNING',
          category: 'PASSENGERS',
          title: `Confiance faible sur ${line.lineName}`,
          description: `Moral voyageurs ${Math.round(line.moraleScoreAfter)}/100. Causes : ${line.topDemandConstraints.slice(0, 2).join(', ')}.`,
          lineId: line.lineId,
        })
      }

      if (previousLine
        && (previousLine.demandSatisfactionRate ?? 1) < 0.86
        && (line.demandSatisfactionRate ?? 1) >= 0.96
        && line.waitingPassengersAfter < previousLine.waitingPassengersAfter * 0.6) {
        items.push({
          id: `recovery:${line.lineId}`,
          day,
          severity: 'INFO',
          category: 'PASSENGERS',
          title: `${line.lineName} retrouve un service fluide`,
          description: `La demande servie remonte à ${Math.round((line.demandSatisfactionRate ?? 1) * 100)} % et la file d’attente recule nettement.`,
          lineId: line.lineId,
        })
      }

      if ((runtime?.consecutiveGoodDays ?? 0) === 3 && line.moraleScoreAfter >= 72) {
        items.push({
          id: `stable:${line.lineId}`,
          day,
          severity: 'INFO',
          category: 'NETWORK',
          title: `${line.lineName} est stable depuis 3 jours`,
          description: `Service régulier, demande correctement absorbée et moral voyageurs satisfaisant. Aucune action urgente n’est nécessaire.`,
          lineId: line.lineId,
        })
      }

      if ((runtime?.consecutiveBadDays ?? 0) >= 3) {
        items.push({
          id: `persistent:${line.lineId}`,
          day,
          severity: (runtime?.consecutiveBadDays ?? 0) >= 6 ? 'CRITICAL' : 'WARNING',
          category: 'PASSENGERS',
          title: `Difficultés persistantes sur ${line.lineName}`,
          description: `${runtime?.consecutiveBadDays ?? 0} journées consécutives sans niveau de service satisfaisant. Les voyageurs commencent à adapter durablement leurs habitudes.`,
          lineId: line.lineId,
        })
      }

      if ((line.controlCost ?? 0) > Math.max(2_000, (line.fineRevenue ?? 0) * 1.35) && (line.controllerCount ?? 0) >= 3) {
        items.push({
          id: `controls:${line.lineId}`,
          day,
          severity: 'INFO',
          category: 'FINANCE',
          title: `Contrôle coûteux sur ${line.lineName}`,
          description: `Le contrôle coûte ${Math.round(line.controlCost ?? 0).toLocaleString(currentGameLocaleTag())} € pour ${Math.round(line.fineRevenue ?? 0).toLocaleString(currentGameLocaleTag())} € d'amendes encaissées aujourd'hui. Cela peut rester un choix de dissuasion, mais mérite votre attention.`,
          lineId: line.lineId,
        })
      }

      if ((line.passengerCompensation ?? 0) > 0) {
        items.push({
          id: `compensation:${line.lineId}`,
          day,
          severity: 'INFO',
          category: 'PASSENGERS',
          title: `Voyageurs remboursés sur ${line.lineName}`,
          description: `${Math.round(line.passengerCompensation ?? 0).toLocaleString(currentGameLocaleTag())} € ont été compensés en raison de la qualité de service. La mesure protège partiellement la confiance voyageurs.`,
          lineId: line.lineId,
        })
      }
    }
  }

  for (const request of save.data.municipalities.requests) {
    if (request.status === 'PENDING') {
      const requestCopy = request.kind === 'ADD_LINE'
        ? 'une nouvelle desserte'
        : request.kind === 'BOOST_SERVICE'
          ? `un renforcement de ${request.targetLineName ?? 'service'}`
          : 'une station supplémentaire'
      items.push({
        id: `municipality:${request.id}`,
        day,
        severity: 'OPPORTUNITY',
        category: 'MUNICIPALITY',
        title: `Proposition de ${request.municipalityName}`,
        description: `La commune propose ${Math.round(request.subsidyAmount / 1_000_000)} M€ estimés pour ${requestCopy}. Décision avant le Jour ${request.decisionDeadlineDay}.`,
        municipalityCode: request.municipalityCode,
      })
      continue
    }

    if (request.status === 'ACCEPTED' && request.completionDeadlineDay !== null) {
      const remaining = request.completionDeadlineDay - day
      if (remaining <= 4) {
        items.push({
          id: `municipality-deadline:${request.id}`,
          day,
          severity: remaining <= 1 ? 'CRITICAL' : 'WARNING',
          category: 'MUNICIPALITY',
          title: `Engagement à tenir avec ${request.municipalityName}`,
          description: `${Math.max(0, remaining)} jour(s) avant l’échéance. L’aide prévue est de ${Math.round(request.subsidyAmount / 1_000_000)} M€ environ.`,
          municipalityCode: request.municipalityCode,
        })
      }
      continue
    }

    if (request.status === 'COMPLETED' && request.resolvedDay === day) {
      items.push({
        id: `municipality-success:${request.id}`,
        day,
        severity: 'INFO',
        category: 'MUNICIPALITY',
        title: `Accord réalisé avec ${request.municipalityName}`,
        description: `${Math.round(request.subsidyAmount / 1_000_000)} M€ de cofinancement ont été versés. La relation avec la commune progresse.`,
        municipalityCode: request.municipalityCode,
      })
    }
  }

  if (save.data.economy.insolvencyStatus === 'BANKRUPT') {
    items.push({
      id: 'debt:bankrupt',
      day,
      severity: 'CRITICAL',
      category: 'FINANCE',
      title: 'Réseau en insolvabilité',
      description: `Plusieurs échéances ont été manquées et la capacité de financement du réseau est dépassée. La partie ne peut plus progresser.`,
    })
  } else if (save.data.economy.insolvencyStatus === 'WARNING') {
    items.push({
      id: 'debt:warning',
      day,
      severity: 'WARNING',
      category: 'FINANCE',
      title: 'Financement sous tension',
      description: `Dette ${Math.round(save.data.economy.debtPrincipal / 1_000_000)} M€ · prochaine échéance au Jour ${save.data.economy.debtNextPaymentDay || '—'}.`,
    })
  }

  if (save.data.economy.debtPrincipal > 1_000_000_000) {
    items.push({
      id: 'debt:high',
      day,
      severity: 'WARNING',
      category: 'FINANCE',
      title: 'Dette élevée',
      description: `Encours actuel : ${Math.round(save.data.economy.debtPrincipal / 1_000_000)} M€. Les intérêts sont prélevés chaque jour.`,
    })
  }

  const sorted = items.sort((a, b) => {
    const order = { CRITICAL: 0, WARNING: 1, OPPORTUNITY: 2, INFO: 3 }
    return order[a.severity] - order[b.severity]
  })

  // Une ligne ne doit pas transformer Événements en mur d'alertes : on expose
  // le problème opérationnel prioritaire, les autres restent visibles dans Réseau.
  const actionableLineIds = new Set<string>()
  return sorted.filter(item => {
    if (!item.lineId || (item.severity !== 'CRITICAL' && item.severity !== 'WARNING')) return true
    if (actionableLineIds.has(item.lineId)) return false
    actionableLineIds.add(item.lineId)
    return true
  })
}
