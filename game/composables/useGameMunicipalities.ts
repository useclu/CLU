import {
  computed,
} from 'vue'

import {
  acceptMunicipalityRequest,
  advanceMunicipalityDevelopment,
  advanceMunicipalityWorldLife,
  negotiateMunicipalityRequest,
  prepareLocalEventService,
  refuseMunicipalityRequest,
  resolveMunicipalityRequestsForDay,
  syncMunicipalityRequests,
} from '../engine/municipalities'
import type { GameLocalEventServiceKind } from '../types/municipalities'

import {
  useGameTerritory,
} from './useGameTerritory'

import {
  useMetropoleGame,
} from './useMetropoleGame'
import { useCluOnline } from './useCluOnline'

function createGameMunicipalities() {
  const game = useMetropoleGame()
  const online = useCluOnline()

  function assertWritable() {
    if (game.isReadOnly.value) throw new Error('Ce défi est terminé : la partie est en lecture seule.')
  }

  function assertOnlinePermission(permission: 'gerer_urbanisme' | 'gerer_exploitation') {
    if (!online.sessionActive.value || online.moi.value?.statut !== 'accepte' || online.estAdmin.value) return
    if (!online.peut(permission)) throw new Error(`Permission requise : ${permission}.`)
  }

  const territory = useGameTerritory()

  const state = computed(
    () => game.state.value.save?.data.municipalities ?? null,
  )

  const requests = computed(
    () => state.value?.requests ?? [],
  )

  const pendingRequests = computed(
    () => requests.value.filter(
      request => request.status === 'PENDING',
    ),
  )

  const acceptedRequests = computed(
    () => requests.value.filter(
      request => request.status === 'ACCEPTED',
    ),
  )

  const recentResolvedRequests = computed(
    () => [...requests.value]
      .filter(
        request => ![
          'PENDING',
          'ACCEPTED',
        ].includes(request.status),
      )
      .sort(
        (first, second) => (
          (second.resolvedDay ?? -1)
          - (first.resolvedDay ?? -1)
        ),
      )
      .slice(0, 6),
  )

  const totalSubsidiesReceived = computed(
    () => state.value?.totalSubsidiesReceived ?? 0,
  )

  const urbanProjects = computed(
    () => state.value?.urbanProjects ?? [],
  )

  const localEvents = computed(
    () => state.value?.localEvents ?? [],
  )

  const activeLocalEvents = computed(
    () => localEvents.value.filter(event => event.status !== 'FINISHED'),
  )

  function relationScore(
    municipalityCode: string,
  ) {
    return state.value?.relations.find(
      relation => relation.code === municipalityCode,
    )?.score ?? 50
  }

  async function syncRequests(
    persist = false,
  ) {
    // La génération des demandes est déterministe mais elle modifie l'état.
    // En Online seul l'admin l'exécute ; les participants reçoivent le résultat.
    if (online.sessionActive.value && online.moi.value?.statut === 'accepte' && !online.estAdmin.value) return false
    assertWritable()
    const save = game.state.value.save

    if (!save) {
      return false
    }

    await territory.ensureLoaded()

    const changed = syncMunicipalityRequests(
      save.data.municipalities,
      territory.summary.value,
      save.data.network,
      save.data.simulationDay,
    )

    if (changed && persist) {
      await game.persistCurrentGame()
    }

    return changed
  }

  async function acceptRequest(
    requestId: string,
  ) {
    assertWritable()
    assertOnlinePermission('gerer_urbanisme')
    const save = game.state.value.save

    if (!save) {
      return false
    }

    const accepted = acceptMunicipalityRequest(
      save.data.municipalities,
      requestId,
      save.data.simulationDay,
    )

    if (accepted) {
      await game.persistCurrentGame()
    }

    return accepted
  }


  async function negotiateRequest(requestId: string, amount: number) {
    assertWritable()
    assertOnlinePermission('gerer_urbanisme')
    const save = game.state.value.save
    if (!save) return { status: 'INVALID' as const }
    const result = negotiateMunicipalityRequest(save.data.municipalities, requestId, amount, save.data.simulationDay)
    if (result.status !== 'INVALID') await game.persistCurrentGame()
    return result
  }

  async function refuseRequest(
    requestId: string,
  ) {
    assertWritable()
    assertOnlinePermission('gerer_urbanisme')
    const save = game.state.value.save

    if (!save) {
      return false
    }

    const refused = refuseMunicipalityRequest(
      save.data.municipalities,
      requestId,
      save.data.simulationDay,
    )

    if (refused) {
      await game.persistCurrentGame()
    }

    return refused
  }

  function processWorldLife(
    day: number,
  ) {
    const save = game.state.value.save
    if (!save) return { changed: false, createdProjects: [], constructionProjects: [], openedProjects: [], maturedProjects: [], announcedEvents: [], startedEvents: [], finishedEvents: [] }
    return advanceMunicipalityWorldLife(
      save.data.municipalities,
      territory.municipalities.value,
      territory.summary.value,
      save.data.network,
      day,
      save.data.simulation.history.at(-1),
    )
  }



  async function prepareLocalEvent(
    eventId: string,
    lineId: string,
    serviceKind: GameLocalEventServiceKind,
    level: 'LIGHT' | 'STRONG',
  ) {
    assertWritable()
    assertOnlinePermission('gerer_exploitation')
    const save = game.state.value.save
    if (!save) return { ok: false as const, reason: 'NO_SAVE' as const, extraTrips: 0 }
    await territory.ensureLoaded()
    const result = prepareLocalEventService(
      save.data.municipalities,
      save.data.network,
      save.data.operations,
      save.data.economy,
      territory.summary.value,
      save.data.calendarStartDate,
      save.data.simulationDay,
      eventId,
      lineId,
      serviceKind,
      level,
    )
    if (result.ok) await game.persistCurrentGame()
    return result
  }


  function processDay(
    day: number,
  ) {
    const save = game.state.value.save

    if (!save) {
      return {
        changed: false,
        subsidyGranted: 0,
      }
    }

    const development = advanceMunicipalityDevelopment(
      save.data.municipalities,
      territory.municipalities.value,
      territory.summary.value,
      save.data.network,
      day,
    )


    const result = resolveMunicipalityRequestsForDay(
      save.data.municipalities,
      save.data.economy,
      territory.summary.value,
      save.data.network,
      day,
    )

    const generated = syncMunicipalityRequests(
      save.data.municipalities,
      territory.summary.value,
      save.data.network,
      day,
    )

    return {
      changed: development.changed || result.changed || generated,
      subsidyGranted: result.subsidyGranted,
      populationDelta: development.totalPopulationDelta,
      developmentMilestones: development.milestones,
    }
  }

  return {
    state,
    requests,
    pendingRequests,
    acceptedRequests,
    recentResolvedRequests,
    totalSubsidiesReceived,
    urbanProjects,
    localEvents,
    activeLocalEvents,
    relationScore,
    syncRequests,
    acceptRequest,
    negotiateRequest,
    refuseRequest,
    prepareLocalEvent,
    processWorldLife,
    processDay,
  }
}

type GameMunicipalitiesRuntime = ReturnType<typeof createGameMunicipalities>
let sharedGameMunicipalities: GameMunicipalitiesRuntime | null = null

export function useGameMunicipalities() {
  // Runtime municipal unique : évite de recréer dans plusieurs panneaux les mêmes filtres de
  // demandes/projets/événements et réutilise le territoire partagé.
  if (!sharedGameMunicipalities) sharedGameMunicipalities = createGameMunicipalities()
  return sharedGameMunicipalities
}
