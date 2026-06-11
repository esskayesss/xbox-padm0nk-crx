// Virtual gamepad layout constants (W3C "standard" mapping).
//
// buttons: 0 A,1 B,2 X,3 Y,4 LB,5 RB,6 LT,7 RT,8 View,9 Menu,
//          10 L3,11 R3,12 DpadUp,13 DpadDown,14 DpadLeft,15 DpadRight,16 Guide
// axes:    0 LX,1 LY,2 RX,3 RY   (Y: up = -1, down = +1)

export const BUTTON_COUNT = 17;
export const AXIS_COUNT = 4;

/** Button index map for the standard gamepad layout. */
export const BUTTON = {
	A: 0,
	B: 1,
	X: 2,
	Y: 3,
	LB: 4,
	RB: 5,
	LT: 6,
	RT: 7,
	View: 8,
	Menu: 9,
	L3: 10,
	R3: 11,
	DpadUp: 12,
	DpadDown: 13,
	DpadLeft: 14,
	DpadRight: 15,
	Guide: 16,
} as const;

/** Axis index map. */
export const AXIS = {
	LX: 0,
	LY: 1,
	RX: 2,
	RY: 3,
} as const;

/** Exact id string the page sees for our virtual pad. */
export const GAMEPAD_ID =
	'padm0nk Virtual Xbox 360 Controller (STANDARD GAMEPAD Vendor: 045e Product: 028e)';

/** W3C mapping reported by the virtual pad. */
export const GAMEPAD_MAPPING = 'standard';
