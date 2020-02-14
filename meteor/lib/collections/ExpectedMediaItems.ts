import { Meteor } from 'meteor/meteor'
import { TransformedCollection } from '../typings/meteor'
import { registerCollection, Time, ProtectedString } from '../lib'
import { createMongoCollection } from './lib'
import { RundownId } from './Rundowns'
import { PartId } from './Parts'
import { StudioId } from './Studios'
import { BucketId } from './Buckets'
import { PieceId } from './Pieces'

/** A string, identifying a ExpectedMediaItem */
export type ExpectedMediaItemId = ProtectedString<'ExpectedMediaItemId'>

export interface ExpectedMediaItemBase {
	_id: ExpectedMediaItemId

	/** Source label that can be used to identify the EMI */
	label?: string

	/** Local path to the media object */
	path: string

	/** Global path to the media object */
	url: string

	/** The studio installation this ExpectedMediaItem was generated in */
	studioId: StudioId

	/** True if the media item has been marked as possibly unavailable */
	disabled: boolean

	/** A label defining a pool of resources */
	mediaFlowId: string

	/** The last time the object was seen / used in Core */
	lastSeen: Time

	/** Time to wait before removing file */
	lingerTime?: number
}

export interface ExpectedMediaItemRundown extends ExpectedMediaItemBase {
	/** The rundown id that is the source of this MediaItem */
	rundownId: RundownId

	/** The part id that is the source of this Media Item */
	partId: PartId

}

export interface ExpectedMediaItemBucket extends ExpectedMediaItemBase {
	/** The bucket id that is the source of this Media Item */
	bucketId: BucketId

	/** The bucked adLib piece that is the source of this Media Item */
	bucketAdLibPieceId: PieceId
}

export type ExpectedMediaItem = ExpectedMediaItemRundown | ExpectedMediaItemBucket

export const ExpectedMediaItems: TransformedCollection<ExpectedMediaItem, ExpectedMediaItem>
	= createMongoCollection<ExpectedMediaItem>('expectedMediaItems')
registerCollection('ExpectedMediaItems', ExpectedMediaItems)
Meteor.startup(() => {
	if (Meteor.isServer) {
		ExpectedMediaItems._ensureIndex({
			path: 1
		})
		ExpectedMediaItems._ensureIndex({
			mediaFlowId: 1,
			studioId: 1
		})
		ExpectedMediaItems._ensureIndex({
			rundownId: 1
		})
	}
})
