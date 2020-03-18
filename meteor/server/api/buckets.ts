import * as _ from 'underscore'
import { Random } from 'meteor/random'
import { Meteor } from 'meteor/meteor'
import { check } from 'meteor/check'
import { Buckets, Bucket, BucketId } from '../../lib/collections/Buckets'
import { literal, Omit, protectString } from '../../lib/lib'
import { ClientAPI } from '../../lib/api/client'
import { BucketSecurity } from '../security/buckets'
import { BucketAdLibs, BucketAdLib } from '../../lib/collections/BucketAdlibs'
import { ExpectedMediaItems } from '../../lib/collections/ExpectedMediaItems'
import { ShowStyleVariants } from '../../lib/collections/ShowStyleVariants'
import { Studios, StudioId } from '../../lib/collections/Studios'
import { PieceId } from '../../lib/collections/Pieces'

const DEFAULT_BUCKET_WIDTH = undefined

export namespace BucketsAPI {
	export function removeBucketAdLib(id: PieceId) {
		BucketAdLibs.remove({
			_id: id
		})
		ExpectedMediaItems.remove({
			bucketAdLibPieceId: id
		})
	}
	
	export function modifyBucket(id: BucketId, bucket: Partial<Omit<Bucket, '_id'>>) {
		Buckets.update(id, {
			$set: _.omit(bucket, [ '_id' ])
		})
	}
	
	export function emptyBucket(id: BucketId) {
		BucketAdLibs.remove({
			bucketId: id
		})
		ExpectedMediaItems.remove({
			bucketId: id
		})
	}
	
	export function createNewBucket(name: string, studioId: StudioId, userId: string | null) {
		const heaviestBucket = Buckets.find({
			studioId
		}, {
			sort: {
				_rank: 1
			},
			fields: {
				_rank: 1
			}
		}).fetch().reverse()[0]

		let rank = 1
		if (heaviestBucket) {
			rank = heaviestBucket._rank + 1
		}

		const newBucket = literal<Bucket>({
			_id: protectString(Random.id()),
			_rank: rank,
			name: name,
			studioId,
			userId,
			width: DEFAULT_BUCKET_WIDTH,
			buttonWidthScale: 1,
			buttonHeightScale: 1
		})
	
		Buckets.insert(newBucket)
	
		return newBucket
	}

	export function modifyBucketAdLib(id: PieceId, adlib: Partial<Omit<BucketAdLib, '_id'>>) {
		if (adlib.bucketId && !Buckets.findOne(adlib.bucketId)) {
			throw new Meteor.Error(`Could not find bucket: "${adlib.bucketId}"`)
		}

		if (adlib.showStyleVariantId && !ShowStyleVariants.findOne(adlib.showStyleVariantId)) {
			throw new Meteor.Error(`Could not find show style variant: "${adlib.showStyleVariantId}"`)
		}

		if (adlib.studioId && !Studios.findOne(adlib.studioId)) {
			throw new Meteor.Error(`Could not find studio: "${adlib.studioId}"`)
		}

		BucketAdLibs.update(id, {
			$set: _.omit(adlib, [ '_id' ])
		})
	}
	
	export function removeBucket(id: BucketId) {
		Buckets.remove(id)
		BucketAdLibs.remove({
			bucketId: id
		})
		ExpectedMediaItems.remove({
			bucketId: id
		})
	}
}
