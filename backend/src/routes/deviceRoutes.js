const express = require('express');
const router = express.Router();
const deviceController = require('../controllers/deviceController');

/**
 * @route   GET /api/devices
 * @desc    Get list of all registered devices
 * @access  Private / Manager
 */
router.get('/devices', deviceController.getDevices);

/**
 * @route   GET /api/devices/:id
 * @desc    Get detailed information for a specific device by ID
 * @access  Private / Manager
 */
router.get('/devices/:id', deviceController.getDeviceById);

/**
 * @route   PUT /api/devices/mode
 * @desc    Switch global room operation mode (AUTO / MANUAL)
 * @access  Private / Manager
 */
router.put('/devices/mode', deviceController.setOperationMode);

/**
 * @route   POST /api/devices/:id/control
 * @desc    Dispatch hardware control command (TURN_ON, TURN_OFF, OPEN, CLOSE, STOP)
 * @access  Private / Manager
 */
router.post('/devices/:id/control', deviceController.controlDevice);

/**
 * @route   GET /api/device-commands
 * @desc    Retrieve command execution history logs
 * @access  Private / Manager
 */
router.get('/device-commands', deviceController.getDeviceCommands);

/**
 * @route   GET /api/device-commands/:id
 * @desc    Retrieve details of a specific command log by ID
 * @access  Private / Manager
 */
router.get('/device-commands/:id', deviceController.getDeviceCommandById);

module.exports = router;