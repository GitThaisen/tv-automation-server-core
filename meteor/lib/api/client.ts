export namespace ClientAPI {
	export enum methods {
		'execMethod' = 'client.execMethod',
		'callPeripheralDeviceFunction' = 'client.callPeripheralDeviceFunction'
	}

	/** Response from a method that's called from the client */
	export interface ClientResponseError {
		/** On error, return error code (default: 500) */
		error: number
		/** On error, provide a human-readable error message */
		message?: string
	}
	/**
	 * Used to reply to the user that the action didn't succeed (but it's not bad enough to log it as an error)
	 * @param errorMessage
	 */
	export function responseError (errorMessage: string): ClientResponseError {
		return {
			error: 500,
			message: errorMessage
		}
	}
	export interface ClientResponseSuccess {
		/** On success, return success code (by default, use 200) */
		success: 200
		/** Optionally, provide method result */
		result?: any
	}
	export function responseSuccess (result?: any): ClientResponseSuccess {
		return {
			success: 200,
			result
		}
	}
	export type ClientResponse = ClientResponseError | ClientResponseSuccess
}
