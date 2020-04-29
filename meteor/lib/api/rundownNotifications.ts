import { RundownId } from '../collections/Rundowns'
import { PartNote } from './notes'
import { PieceId } from '../collections/Pieces'
import { RundownAPI } from './rundown'
import { PartId } from '../collections/Parts'
import { SegmentId } from '../collections/Segments'

export interface IMediaObjectIssue {
	segmentRank: number,
	partRank: number,
	partId: PartId,
	rundownId: RundownId,
	segmentId: SegmentId,
	pieceId: PieceId,
	name: string,
	status: RundownAPI.PieceStatusCode,
	message: string | null
}

export enum RundownNotificationsAPIMethods {
	'getSegmentPartNotes' = 'rundownNotifications.getSegmentPartNotes',
	'getMediaObjectIssues' = 'rundownNotifications.getMediaObjectIssues'
}

export type RankedPartNote = PartNote & {
	rank: number
}

export interface RundownNotificationsAPI {
	getSegmentPartNotes (rRundownIds: RundownId[]): Promise<RankedPartNote[]>
	getMediaObjectIssues (rundownIds: RundownId[]): Promise<IMediaObjectIssue[]>
}