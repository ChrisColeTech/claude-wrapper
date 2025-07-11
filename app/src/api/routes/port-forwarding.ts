import express from 'express';
import { logger } from '../../utils/logger';
import { WSLHelper } from '../../utils/wsl-helper';
import { EnvironmentManager } from '../../config/env';

const router = express.Router();

/**
 * @openapi
 * /port-forwarding/script.bat:
 *   get:
 *     summary: Download WSL port forwarding batch script
 *     description: Downloads a Windows batch script to set up port forwarding from Windows to WSL
 *     responses:
 *       200:
 *         description: Batch script file
 *         content:
 *           application/octet-stream:
 *             schema:
 *               type: string
 *               format: binary
 *       404:
 *         description: WSL not detected or script not available
 *       500:
 *         description: Server error
 */
router.get('/port-forwarding/script.bat', (req, res) => {
  try {
    const wslInfo = WSLHelper.getWSLInfo();
    
    if (!wslInfo.isWSL) {
      res.status(404).json({
        error: 'WSL environment not detected',
        message: 'Port forwarding scripts are only available in WSL environments'
      });
      return;
    }

    if (!wslInfo.wslIP) {
      res.status(404).json({
        error: 'WSL IP not detected',
        message: 'Could not determine WSL IP address for port forwarding'
      });
      return;
    }

    const config = EnvironmentManager.getConfig();
    const port = parseInt(config.port.toString());
    
    // Generate the script content (this also saves to disk)
    const { batchScript } = WSLHelper.generatePortForwardingScript(port, wslInfo.wslIP);
    
    // Set headers for file download
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="claude-wrapper-port-${port}.bat"`);
    
    logger.info('Port forwarding batch script requested', {
      port,
      wslIP: wslInfo.wslIP,
      userAgent: req.get('User-Agent')
    });
    
    res.send(batchScript);
  } catch (error) {
    logger.error('Failed to generate port forwarding batch script', error instanceof Error ? error : new Error(String(error)));
    res.status(500).json({
      error: 'Failed to generate script',
      message: 'An error occurred while generating the port forwarding script'
    });
  }
});

/**
 * @openapi
 * /port-forwarding/script.ps1:
 *   get:
 *     summary: Download WSL port forwarding PowerShell script
 *     description: Downloads a Windows PowerShell script to set up port forwarding from Windows to WSL
 *     responses:
 *       200:
 *         description: PowerShell script file
 *         content:
 *           application/octet-stream:
 *             schema:
 *               type: string
 *               format: binary
 *       404:
 *         description: WSL not detected or script not available
 *       500:
 *         description: Server error
 */
router.get('/port-forwarding/script.ps1', (req, res) => {
  try {
    const wslInfo = WSLHelper.getWSLInfo();
    
    if (!wslInfo.isWSL) {
      res.status(404).json({
        error: 'WSL environment not detected',
        message: 'Port forwarding scripts are only available in WSL environments'
      });
      return;
    }

    if (!wslInfo.wslIP) {
      res.status(404).json({
        error: 'WSL IP not detected',
        message: 'Could not determine WSL IP address for port forwarding'
      });
      return;
    }

    const config = EnvironmentManager.getConfig();
    const port = parseInt(config.port.toString());
    
    // Generate the script content
    const { powershellScript } = WSLHelper.generatePortForwardingScript(port, wslInfo.wslIP);
    
    // Set headers for file download
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="claude-wrapper-port-${port}.ps1"`);
    
    logger.info('Port forwarding PowerShell script requested', {
      port,
      wslIP: wslInfo.wslIP,
      userAgent: req.get('User-Agent')
    });
    
    res.send(powershellScript);
  } catch (error) {
    logger.error('Failed to generate port forwarding PowerShell script', error instanceof Error ? error : new Error(String(error)));
    res.status(500).json({
      error: 'Failed to generate script',
      message: 'An error occurred while generating the port forwarding script'
    });
  }
});

export default router;