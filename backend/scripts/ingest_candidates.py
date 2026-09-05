"""Deployment entry point for candidate data enrichment."""
import asyncio

from enrich_candidates import enrich_candidates


if __name__ == "__main__":
    asyncio.run(enrich_candidates())
