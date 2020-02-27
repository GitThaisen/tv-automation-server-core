import { Meteor } from 'meteor/meteor'
import { Random } from 'meteor/random'
import { check } from 'meteor/check'
import { Methods, setMeteorMethods } from '../methods'
import { StudiosAPI } from '../../lib/api/studios'
import { Studios, Studio, DBStudio, StudioId } from '../../lib/collections/Studios'
import { literal, getRandomId } from '../../lib/lib'
import { Rundown, Rundowns } from '../../lib/collections/Rundowns'
import { PeripheralDevices } from '../../lib/collections/PeripheralDevices'
import { ShowStyleBaseId } from '../../lib/collections/ShowStyleBases'

export function insertStudio (newId?: StudioId): StudioId {
	if (newId) check(newId, String)

	let id = Studios.insert(literal<DBStudio>({
		_id: newId || getRandomId(),
		name: 'New Studio',
		// blueprintId?: BlueprintId
		mappings: {},
		supportedShowStyleBase: [],
		config: [],
		// testToolsConfig?: ITestToolsConfig
		settings: {
			mediaPreviewsUrl: '',
			sofieUrl: ''
		},
		_rundownVersionHash: ''
	}))
	return id
}
export function removeStudio (id: StudioId): void {
	check(id, String)

	const studio = Studios.findOne(id)
	if (!studio) throw new Meteor.Error(404, `Studio "${id}" not found`)

	// allowed to remove?
	const rundown = Rundowns.findOne({ studioId: studio._id })
	if (rundown) throw new Meteor.Error(404, `Can't remoce studio "${id}", because the rundown "${rundown._id}" is in it.`)

	const peripheralDevice = PeripheralDevices.findOne({ studioId: studio._id })
	if (peripheralDevice) throw new Meteor.Error(404, `Can't remoce studio "${id}", because the peripheralDevice "${peripheralDevice._id}" is in it.`)

	Studios.remove(id)
}

let methods: Methods = {}
methods[StudiosAPI.methods.insertStudio] = () => {
	return insertStudio()
}
methods[StudiosAPI.methods.removeStudio] = (studioId: StudioId) => {
	return removeStudio(studioId)
}

// Apply methods:
setMeteorMethods(methods)
