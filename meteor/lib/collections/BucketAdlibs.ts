import { PieceGeneric } from './Pieces'
import { TransformedCollection } from '../typings/meteor'
import { registerCollection } from '../lib'
import { Meteor } from 'meteor/meteor'
import { IBlueprintAdLibPiece, BaseContent } from 'tv-automation-sofie-blueprints-integration'
import { createMongoCollection } from './lib'
import { RundownImportVersions } from './Rundowns';

export interface BucketAdLib extends IBlueprintAdLibPiece {
	_id: string
	bucketId: string

	/**
	 * If an AdLib within the Bucket doesn't match the studioId/showStyleVariantId combination
	 * the adLib will be shown as disabled
	 */
	studioId: string
	showStyleVariantId: string
	
	importVersions: RundownImportVersions // TODO - is this good?
}

export const BucketAdLibs: TransformedCollection<BucketAdLib, BucketAdLib> = createMongoCollection<BucketAdLib>('bucketAdlibs')
registerCollection('BucketAdLibs', BucketAdLibs)
Meteor.startup(() => {
	if (Meteor.isServer) {
		BucketAdLibs._ensureIndex({
			bucketId: 1,
			studioId: 1
		})
	}
})
