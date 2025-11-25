"""
Tests for hl-decide P&L calculation and state recovery.
"""
import pytest
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch, create_autospec
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.main import calculate_pnl
from contracts.py.models import SignalEvent, ScoreEvent, FillEvent


class TestPnLCalculation:
    """Test P&L calculation logic."""

    @pytest.mark.asyncio
    async def test_long_profit(self):
        """Test P&L calculation for profitable long position."""
        signal = SignalEvent(
            ticket_id="test-1",
            address="0x1234",
            asset="BTC",
            side="long",
            confidence=0.8,
            score_ts=datetime.utcnow(),
            signal_ts=datetime.utcnow(),
            expires_at=datetime.utcnow() + timedelta(seconds=10),
            reason="consensus",
            payload={}
        )
        entry_price = 50000.0
        exit_price = 51000.0

        result = await calculate_pnl(signal, entry_price, exit_price)

        # (51000 - 50000) / 50000 = 0.02 (2% profit)
        assert result == pytest.approx(0.02, rel=1e-5)

    @pytest.mark.asyncio
    async def test_long_loss(self):
        """Test P&L calculation for losing long position."""
        signal = SignalEvent(
            ticket_id="test-2",
            address="0x1234",
            asset="BTC",
            side="long",
            confidence=0.8,
            score_ts=datetime.utcnow(),
            signal_ts=datetime.utcnow(),
            expires_at=datetime.utcnow() + timedelta(seconds=10),
            reason="consensus",
            payload={}
        )
        entry_price = 50000.0
        exit_price = 49000.0

        result = await calculate_pnl(signal, entry_price, exit_price)

        # (49000 - 50000) / 50000 = -0.02 (2% loss)
        assert result == pytest.approx(-0.02, rel=1e-5)

    @pytest.mark.asyncio
    async def test_short_profit(self):
        """Test P&L calculation for profitable short position."""
        signal = SignalEvent(
            ticket_id="test-3",
            address="0x1234",
            asset="BTC",
            side="short",
            confidence=0.8,
            score_ts=datetime.utcnow(),
            signal_ts=datetime.utcnow(),
            expires_at=datetime.utcnow() + timedelta(seconds=10),
            reason="consensus",
            payload={}
        )
        entry_price = 50000.0
        exit_price = 49000.0

        result = await calculate_pnl(signal, entry_price, exit_price)

        # (50000 - 49000) / 50000 = 0.02 (2% profit)
        assert result == pytest.approx(0.02, rel=1e-5)

    @pytest.mark.asyncio
    async def test_short_loss(self):
        """Test P&L calculation for losing short position."""
        signal = SignalEvent(
            ticket_id="test-4",
            address="0x1234",
            asset="BTC",
            side="short",
            confidence=0.8,
            score_ts=datetime.utcnow(),
            signal_ts=datetime.utcnow(),
            expires_at=datetime.utcnow() + timedelta(seconds=10),
            reason="consensus",
            payload={}
        )
        entry_price = 50000.0
        exit_price = 51000.0

        result = await calculate_pnl(signal, entry_price, exit_price)

        # (50000 - 51000) / 50000 = -0.02 (2% loss)
        assert result == pytest.approx(-0.02, rel=1e-5)

    @pytest.mark.asyncio
    async def test_zero_entry_price(self):
        """Test P&L calculation returns 0 for invalid entry price."""
        signal = SignalEvent(
            ticket_id="test-5",
            address="0x1234",
            asset="BTC",
            side="long",
            confidence=0.8,
            score_ts=datetime.utcnow(),
            signal_ts=datetime.utcnow(),
            expires_at=datetime.utcnow() + timedelta(seconds=10),
            reason="consensus",
            payload={}
        )
        entry_price = 0.0
        exit_price = 50000.0

        result = await calculate_pnl(signal, entry_price, exit_price)

        assert result == 0.0

    @pytest.mark.asyncio
    async def test_zero_exit_price(self):
        """Test P&L calculation returns 0 for invalid exit price."""
        signal = SignalEvent(
            ticket_id="test-6",
            address="0x1234",
            asset="BTC",
            side="long",
            confidence=0.8,
            score_ts=datetime.utcnow(),
            signal_ts=datetime.utcnow(),
            expires_at=datetime.utcnow() + timedelta(seconds=10),
            reason="consensus",
            payload={}
        )
        entry_price = 50000.0
        exit_price = 0.0

        result = await calculate_pnl(signal, entry_price, exit_price)

        assert result == 0.0

    @pytest.mark.asyncio
    async def test_negative_prices(self):
        """Test P&L calculation returns 0 for negative prices."""
        signal = SignalEvent(
            ticket_id="test-7",
            address="0x1234",
            asset="BTC",
            side="long",
            confidence=0.8,
            score_ts=datetime.utcnow(),
            signal_ts=datetime.utcnow(),
            expires_at=datetime.utcnow() + timedelta(seconds=10),
            reason="consensus",
            payload={}
        )
        entry_price = -50000.0
        exit_price = 51000.0

        result = await calculate_pnl(signal, entry_price, exit_price)

        assert result == 0.0

    @pytest.mark.asyncio
    async def test_large_profit(self):
        """Test P&L calculation for large profitable trade."""
        signal = SignalEvent(
            ticket_id="test-8",
            address="0x1234",
            asset="BTC",
            side="long",
            confidence=0.8,
            score_ts=datetime.utcnow(),
            signal_ts=datetime.utcnow(),
            expires_at=datetime.utcnow() + timedelta(seconds=10),
            reason="consensus",
            payload={}
        )
        entry_price = 50000.0
        exit_price = 75000.0

        result = await calculate_pnl(signal, entry_price, exit_price)

        # (75000 - 50000) / 50000 = 0.5 (50% profit)
        assert result == pytest.approx(0.5, rel=1e-5)

    @pytest.mark.asyncio
    async def test_large_loss(self):
        """Test P&L calculation for large losing trade."""
        signal = SignalEvent(
            ticket_id="test-9",
            address="0x1234",
            asset="BTC",
            side="long",
            confidence=0.8,
            score_ts=datetime.utcnow(),
            signal_ts=datetime.utcnow(),
            expires_at=datetime.utcnow() + timedelta(seconds=10),
            reason="consensus",
            payload={}
        )
        entry_price = 50000.0
        exit_price = 25000.0

        result = await calculate_pnl(signal, entry_price, exit_price)

        # (25000 - 50000) / 50000 = -0.5 (50% loss)
        assert result == pytest.approx(-0.5, rel=1e-5)
