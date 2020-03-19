
/* tslint:disable:no-use-before-declare */
import { Resolver } from 'superfly-timeline'
import * as _ from 'underscore'
import { Part, PartId } from '../../../lib/collections/Parts'
import { Piece } from '../../../lib/collections/Pieces'
import { literal, extendMandadory, getCurrentTime, clone, normalizeArray, protectString, unprotectObject, unprotectString } from '../../../lib/lib'
import {
	TimelineContentTypeOther,
	TimelineObjPieceAbstract,
	TimelineObjGroup,
	TimelineObjType,
	TimelineObjRundown,
	TimelineObjGeneric,
} from '../../../lib/collections/Timeline'
import { logger } from '../../logging'
import {
	getPieceGroupId,
	getPieceFirstObjectId,
	TimelineObjectCoreExt,
	OnGenerateTimelineObj,
	TSR
} from 'tv-automation-sofie-blueprints-integration'
import { transformTimeline } from '../../../lib/timeline'
import { AdLibPiece, AdLibPieceGeneric } from '../../../lib/collections/AdLibPieces'
import { Random } from 'meteor/random'
import { prefixAllObjectIds } from './lib'
import { RundownPlaylistPlayoutData } from '../../../lib/collections/RundownPlaylists'
import { PieceInstance, ResolvedPieceInstance, PieceInstanceId, PieceInstancePiece } from '../../../lib/collections/PieceInstances'
import { PartInstance } from '../../../lib/collections/PartInstances'

export interface PieceResolved extends Piece {
	/** Resolved start time of the piece */
	resolvedStart: number
	/** Whether the piece was successfully resolved */
	resolved: boolean
}
export function sortPiecesByStart (pieces: Piece[]): Piece[] {
	pieces.sort((a, b) => {
		if (a.enable.start < b.enable.start) {
			return -1
		} else if (a.enable.start > b.enable.start) {
			return 1
		} else {
			// Transitions first
			if (a.isTransition && !b.isTransition) {
				return -1
			} else if (!a.isTransition && b.isTransition) {
				return 1
			}
			// Then go by id to make it consistent
			else if (a._id < b._id) {
				return -1
			} else if (a._id > b._id) {
				return 1
			} else {
				return 0
			}
		}
	})

	return pieces
}

export function createPieceGroupFirstObject (
	pieceInstance: PieceInstance,
	pieceGroup: TimelineObjRundown,
	firstObjClasses?: string[]
): (TimelineObjPieceAbstract & OnGenerateTimelineObj) {
	const firstObject = literal<TimelineObjPieceAbstract & OnGenerateTimelineObj>({
		id: getPieceFirstObjectId(unprotectObject(pieceInstance.piece)),
		_id: protectString(''), // set later
		studioId: protectString(''), // set later
		pieceInstanceId: unprotectString(pieceInstance._id),
		infinitePieceId: unprotectString(pieceInstance.piece.infiniteId),
		objectType: TimelineObjType.RUNDOWN,
		enable: { start: 0 },
		layer: pieceInstance.piece.sourceLayerId + '_firstobject',
		content: {
			deviceType: TSR.DeviceType.ABSTRACT,
			type: 'callback',
			callBack: 'piecePlaybackStarted',
			callBackData: {
				rundownId: pieceInstance.rundownId,
				pieceInstanceId: pieceInstance._id,
				dynamicallyInserted: pieceInstance.piece.dynamicallyInserted
			},
			callBackStopped: 'piecePlaybackStopped' // Will cause a callback to be called, when the object stops playing:
		},
		classes: firstObjClasses,
		inGroup: pieceGroup.id
	})
	return firstObject
}
export function createPieceGroup (
	pieceInstance: Pick<PieceInstance, '_id' | 'piece'>,
	partGroup?: TimelineObjRundown,
	enable?: TSR.Timeline.TimelineEnable
): TimelineObjGroup & TimelineObjRundown & OnGenerateTimelineObj {
	return literal<TimelineObjGroup & TimelineObjRundown & OnGenerateTimelineObj>({
		id: getPieceGroupId(unprotectObject(pieceInstance.piece)),
		_id: protectString(''), // set later
		studioId: protectString(''), // set later
		content: {
			deviceType: TSR.DeviceType.ABSTRACT,
			type: TimelineContentTypeOther.GROUP
		},
		children: [],
		inGroup: partGroup && partGroup.id,
		isGroup: true,
		pieceInstanceId: unprotectString(pieceInstance._id),
		infinitePieceId: unprotectString(pieceInstance.piece.infiniteId),
		objectType: TimelineObjType.RUNDOWN,
		enable: enable === undefined ? pieceInstance.piece.enable : enable,
		layer: pieceInstance.piece.sourceLayerId,
		metadata: {
			pieceId: pieceInstance._id
		}
	})
}

function resolvePieceTimeline (objs: TimelineObjGeneric[], baseTime: number, pieceInstanceMap: { [id: string]: PieceInstance | undefined }, resolveForStr: string): ResolvedPieceInstance[] {
	const tlResolved = Resolver.resolveTimeline(transformTimeline(objs), {
		time: baseTime
	})
	const resolvedPieces: Array<ResolvedPieceInstance> = []

	let unresolvedIds: string[] = []
	_.each(tlResolved.objects, (obj0) => {
		const obj = obj0 as any as TimelineObjRundown
		const id = (obj.metadata || {}).pieceId

		if (!id) return

		const pieceInstance = pieceInstanceMap[id]
		// Erm... How?
		if (!pieceInstance) {
			unresolvedIds.push(id)
			return
		}

		if (obj0.resolved.resolved && obj0.resolved.instances && obj0.resolved.instances.length > 0) {
			const firstInstance = obj0.resolved.instances[0] || {}
			resolvedPieces.push(literal<ResolvedPieceInstance>({
				...pieceInstance,
				resolvedStart: firstInstance.start || baseTime,
				resolvedDuration: firstInstance.end ? firstInstance.end - (firstInstance.start || baseTime) : undefined
			}))
		} else {
			resolvedPieces.push(literal<ResolvedPieceInstance>({
				...pieceInstance,
				resolvedStart: baseTime,
				resolvedDuration: undefined
			}))
			unresolvedIds.push(id)
		}
	})

	if (tlResolved.statistics.unresolvedCount > 0) {
		logger.warn(`Got ${tlResolved.statistics.unresolvedCount} unresolved pieces for ${resolveForStr} (${unresolvedIds.join(', ')})`)
	}
	if (_.size(pieceInstanceMap) !== resolvedPieces.length) {
		logger.warn(`Got ${resolvedPieces.length} ordered pieces. Expected ${_.size(pieceInstanceMap)}. for ${resolveForStr}`)
	}

	// Sort the pieces by time, then transitions first
	resolvedPieces.sort((a, b) => {
		if (a.resolvedStart < b.resolvedStart) {
			return -1
		} else if (a.resolvedStart > b.resolvedStart) {
			return 1
		} else {
			if (a.piece.isTransition === b.piece.isTransition) {
				return 0
			} else if (b.piece.isTransition) {
				return 1
			} else {
				return -1
			}
		}
	})

	// Clamp the times to be reasonably valid
	resolvedPieces.forEach(resolvedPiece => {
		resolvedPiece.resolvedStart = Math.max(0, resolvedPiece.resolvedStart - 1)
		resolvedPiece.resolvedDuration = resolvedPiece.resolvedDuration ? Math.max(0, resolvedPiece.resolvedDuration) : undefined // TODO does this behave the same?
	})

	return resolvedPieces
}

export function getResolvedPieces (partInstance: PartInstance): ResolvedPieceInstance[] {
	const pieceInstances = partInstance.getAllPieceInstances()

	const pieceInststanceMap = normalizeArray(pieceInstances, '_id')

	const objs = pieceInstances.map(piece => clone(createPieceGroup(piece)))
	objs.forEach(o => {
		if (o.enable.start === 'now' && partInstance.part.getLastStartedPlayback()) {
			// Emulate playout starting now. TODO - ensure didnt break other uses
			o.enable.start = getCurrentTime() - (partInstance.part.getLastStartedPlayback() || 0)
		} else if (o.enable.start === 0 || o.enable.start === 'now') {
			o.enable.start = 1
		}
	})

	const resolvedPieces = resolvePieceTimeline(objs, 0, pieceInststanceMap, `PartInstance #${partInstance._id}`)

	// crop infinite pieces
	resolvedPieces.forEach((pieceInstance, index, source) => {
		if (pieceInstance.infinite) {
			for (let i = index + 1; i < source.length; i++) {
				const sourcePieceInstance = source[i]
				if (pieceInstance.piece.sourceLayerId === sourcePieceInstance.piece.sourceLayerId) {
					// TODO - verify this (it is different to the getResolvedPiecesFromFullTimeline...)
					pieceInstance.resolvedDuration = sourcePieceInstance.resolvedStart - pieceInstance.resolvedStart
					return
				}
			}
		}
	})

	return resolvedPieces
}
export function getResolvedPiecesFromFullTimeline (playoutData: RundownPlaylistPlayoutData, allObjs: TimelineObjGeneric[]): { pieces: ResolvedPieceInstance[], time: number } {
	const objs = clone(allObjs.filter(o => o.isGroup && ((o as any).isPartGroup || (o.metadata && o.metadata.pieceId))))

	const now = getCurrentTime()

	const partInstanceIds = _.compact([playoutData.rundownPlaylist.previousPartInstanceId, playoutData.rundownPlaylist.currentPartInstanceId])
	const pieceInstances: PieceInstance[] = playoutData.selectedInstancePieces.filter(p => partInstanceIds.indexOf(p.partInstanceId) !== -1)

	if (playoutData.currentPartInstance && playoutData.currentPartInstance.part.autoNext && playoutData.rundownPlaylist.nextPartInstanceId) {
		pieceInstances.push(...playoutData.selectedInstancePieces.filter(p => p.partInstanceId === playoutData.rundownPlaylist.nextPartInstanceId))
	}

	const pieceInststanceMap = normalizeArray(pieceInstances, '_id')

	objs.forEach(o => {
		if (o.enable.start === 'now') {
			o.enable.start = now
		}
	})

	const resolvedPieces = resolvePieceTimeline(objs, now, pieceInststanceMap, 'timeline')

	// crop infinite pieces
	resolvedPieces.forEach((instance, index, source) => {
		if (instance.infinite) { // && piece.infiniteMode !== PieceLifespan.OutOnNextPart) {
			for (let i = index + 1; i < source.length; i++) {
				const sourceInstance = source[i]
				if (instance.piece.sourceLayerId === sourceInstance.piece.sourceLayerId) {
					// TODO - verify this, the min is necessary and correct though (and it is different to getResolvedPieces)
					const infDuration = sourceInstance.resolvedStart - instance.resolvedStart
					if (instance.resolvedDuration) {
						instance.resolvedDuration = Math.min(instance.resolvedDuration, infDuration)
					} else {
						instance.resolvedDuration = infDuration
					}
					return
				}
			}
		}
	})

	return {
		pieces: resolvedPieces,
		time: now
	}
}


export function convertPieceToAdLibPiece (piece: PieceInstancePiece): AdLibPiece {
	// const oldId = piece._id
	const newId = Random.id()
	const newAdLibPiece = literal<AdLibPiece>({
		..._.omit(piece, 'userDuration', 'timings', 'startedPlayback', 'stoppedPlayback', 'infiniteId'),
		_id: newId,
		_rank: 0,
		disabled: false,
		dynamicallyInserted: true,
		// TODO
		// infiniteMode: piece.originalInfiniteMode !== undefined ? piece.originalInfiniteMode : piece.infiniteMode,
		expectedDuration: _.isNumber(piece.enable.duration) ? piece.enable.duration : 0
	})

	if (newAdLibPiece.content && newAdLibPiece.content.timelineObjects) {
		let contentObjects = newAdLibPiece.content.timelineObjects
		const objs = prefixAllObjectIds(
			_.compact(
				_.map(contentObjects, (obj: TimelineObjectCoreExt) => {
					return extendMandadory<TimelineObjectCoreExt, TimelineObjGeneric>(obj, {
						_id: protectString(''), // set later
						studioId: protectString(''), // set later
						objectType: TimelineObjType.RUNDOWN
					})
				})
			),
			newId + '_'
		)
		newAdLibPiece.content.timelineObjects = objs
	}
	return newAdLibPiece
}

export function convertAdLibToPieceInstance (adLibPiece: AdLibPieceGeneric | PieceInstancePiece, partInstance: PartInstance, queue: boolean): PieceInstance {
	let duration: number | string | undefined = undefined
	if (adLibPiece['expectedDuration']) {
		duration = adLibPiece['expectedDuration']
	} else if (adLibPiece['enable'] && adLibPiece['enable'].duration) {
		duration = adLibPiece['enable'].duration
	}

	const newPieceId = Random.id()
	const newPieceInstance = literal<PieceInstance>({
		_id: protectString(`${partInstance._id}_${newPieceId}`),
		rundownId: partInstance.rundownId,
		partInstanceId: partInstance._id,
		piece: {
			..._.omit(adLibPiece, '_rank', 'expectedDuration', 'startedPlayback', 'stoppedPlayback'), // TODO - this could be typed stronger
			_id: newPieceId,
			rundownId: partInstance.rundownId,
			partId: partInstance.part._id,
			enable: {
				start: (queue ? 0 : 'now'),
				duration: duration
			},
			adLibSourceId: adLibPiece._id,
			dynamicallyInserted: !queue,
			timings: {
				take: [getCurrentTime()],
				startedPlayback: [],
				next: [],
				stoppedPlayback: [],
				playOffset: [],
				takeDone: [],
				takeOut: [],
			}
		}
	})

	if (newPieceInstance.piece.content && newPieceInstance.piece.content.timelineObjects) {
		let contentObjects = newPieceInstance.piece.content.timelineObjects
		const objs = prefixAllObjectIds(_.compact(
			_.map(contentObjects, (obj) => {
				return extendMandadory<TimelineObjectCoreExt, TimelineObjGeneric>(obj, {
					_id: protectString(''), // set later
					studioId: protectString(''), // set later
					objectType: TimelineObjType.RUNDOWN
				})
			})
		), newPieceId + '_')
		newPieceInstance.piece.content.timelineObjects = objs
	}
	return newPieceInstance
}
