import {
  computed,
} from 'vue'

import {
  acceptMunicipalityRequest,
  negotiateMunicipalityRequest,
  refuseMunicipalityRequest,
  resolveMunicipalityRequestsForDay,
  syncMunicipalityRequests,
} from '../engine/municipalities'

import {
  useGameTerritory,
} from './useGameTerritory'

import {
  useMetropoleGame,
} from './useMetropoleGame'

export function useGameMunicipalities() {
  const game = useMetropoleGame()

  function assertWritable() {
    if (game.isReadOnly.value) throw new Error('Ce défi est terminé : la partie est en lecture seule.')
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
      changed: result.changed || generated,
      subsidyGranted: result.subsidyGranted,
    }
  }

  return {
    state,
    requests,
    pendingRequests,
    acceptedRequests,
    recentResolvedRequests,
    totalSubsidiesReceived,
    relationScore,
    syncRequests,
    acceptRequest,
    negotiateRequest,
    refuseRequest,
    processDay,
  }
}
