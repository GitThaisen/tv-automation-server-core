import { NoraPayload } from 'tv-automation-sofie-blueprints-integration';

export { createMosObjectXmlStringFromPayload }

function createMosObjectXmlStringFromPayload (payload: NoraPayload): string {
	const doc = objectToXML({
		ncsItem: {
			item: {
				itemSlug: null,
				mosExternalMetadata: {
					mosSchema: 'http://nora.core.mesosint.nrk.no/mos/content',
					mosPayload: {
						metadata: {
							selection: {
								design: {
									id: payload.manifest
								},
								type: {
									id: payload.template.layer
								},
								mal: {
									id: payload.template.name
								}
							},
							type: payload.template.layer,
							userContext: {}
						},
						content: {
							navn: payload.content.navn,
							tittel: payload.content.tittel,
							_valid: payload.content._valid
						}
					}
				}
			},
		}
	}, 'mos'
	)

	return new XMLSerializer().serializeToString(doc)
}

function objectToXML (obj: object, rootName: string): Document {
	const doc = new Document()
	const root = doc.createElement(rootName)

	addNodes(obj, root)

	doc.appendChild(root)
	return doc
}

function addNodes (obj: object, rootNode: Node): void {
	const doc = rootNode.ownerDocument

	for (const name of Object.keys(obj)) {
		const node = doc.createElement(name)
		rootNode.appendChild(node)

		const value = obj[ name ]
		if (typeof value === 'object' && value !== null) {
			addNodes(value, node)
		} else {
			node.textContent = value
		}
	}
}
