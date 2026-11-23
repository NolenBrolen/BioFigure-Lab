/*
 * Placeholder text for the paper preview: an original, made-up review on
 * mitochondria, written in the style of a journal article so the page reads
 * like a real paper. It is not copied from any published work.
 *
 * Markup: *word* is set in italics (gene names, species, variables).
 */

export type PaperBlock = { kind: 'heading'; text: string } | { kind: 'paragraph'; text: string }

/** A journal name that is clearly invented, so the page never looks like a real journal's. */
export const PAPER_RUNNING_HEAD = 'Reports in Placeholder Biology (2026) 7:301–314'

export const PAPER_TITLE = 'Mitochondrial dynamics and quality control in cellular energy metabolism'

export const PAPER_AUTHORS = 'A. Author¹ · B. Author¹ · C. Author²'

export const PAPER_ABSTRACT =
  'Mitochondria are best known as the site of oxidative phosphorylation, but their function depends equally on their shape, number and position within the cell. ' +
  'Here we review how the respiratory chain is organised within the folds of the inner membrane, how cycles of fusion and fission remodel the mitochondrial network, ' +
  'and how damaged organelles are recognised and removed by mitophagy. We further discuss how pluripotent stem cells switch from glycolysis to oxidative metabolism ' +
  'during differentiation, and how mitochondrial metabolites link energy production to chromatin regulation and cell fate.'

/** The default caption, used until the figure has a caption of its own. */
export const PAPER_CAPTION_LABEL = 'Fig. 1'
export const PAPER_CAPTION =
  'Schematic overview. (A–C) Placeholder caption: in the published paper, this text describes each panel of the figure, ' +
  'explains the symbols, colours and abbreviations used, and states how many independent experiments the data represent. ' +
  'Scale bars and statistical tests are usually given here as well.'

export const PAPER_BODY: readonly PaperBlock[] = [
  {
    kind: 'paragraph',
    text:
      'Mitochondria are double-membrane organelles that convert the chemical energy stored in nutrients into adenosine triphosphate (ATP), the main energy currency of the cell [12]. ' +
      'Beyond this classical role, they take part in calcium buffering, the synthesis of haem and iron–sulfur clusters, the regulation of apoptosis and the production of reactive oxygen species (ROS) that act as signalling molecules [13, 14]. ' +
      'Because each of these functions depends on the shape, number and position of the organelle, mitochondria are best understood not as isolated compartments but as a dynamic network that is continuously remodelled in response to the energetic needs of the cell (Fig. 1).',
  },
  { kind: 'heading', text: '2.1 Architecture of the inner membrane' },
  {
    kind: 'paragraph',
    text:
      'The outer mitochondrial membrane is smooth and permeable to small molecules through voltage-dependent anion channels (VDACs), whereas the inner membrane is folded into cristae that greatly increase its surface area [15]. ' +
      'The cristae house the complexes of the electron transport chain (ETC) and the ATP synthase, which assemble into higher-order supercomplexes. ' +
      'Their architecture is maintained by the mitochondrial contact site and cristae organising system (MICOS) and by the dynamin-related GTPase OPA1, which keeps cristae junctions narrow [16, 17]. ' +
      'Loss of *OPA1* widens these junctions, releases cytochrome *c* into the intermembrane space and lowers the efficiency of respiration, illustrating how membrane shape and bioenergetic output are directly linked.',
  },
  {
    kind: 'paragraph',
    text:
      'Electrons derived from NADH and FADH₂ enter the chain at complex I and complex II, respectively, and are passed via ubiquinone and complex III to cytochrome *c* and finally to complex IV, where molecular oxygen is reduced to water [18]. ' +
      'The energy released at complexes I, III and IV is used to pump protons across the inner membrane, creating an electrochemical gradient of roughly 150–180 mV. ' +
      'Protons flowing back through the F₀ portion of ATP synthase drive the rotation of its central stalk, and each full turn yields three molecules of ATP [19]. ' +
      'A small fraction of electrons escapes the chain prematurely, mainly at complexes I and III, and reduces oxygen to superoxide. ' +
      'At low levels these ROS support signalling and adaptation; at high levels they damage lipids, proteins and mitochondrial DNA (mtDNA) [20].',
  },
  { kind: 'heading', text: '2.2 Fusion and fission' },
  {
    kind: 'paragraph',
    text:
      'Mitochondria constantly fuse and divide. Fusion of the outer membrane is mediated by the mitofusins MFN1 and MFN2, whereas fusion of the inner membrane requires OPA1 [21]. ' +
      'Fission is driven by the cytosolic GTPase DRP1, which is recruited to the outer membrane by the adaptor proteins MFF, MiD49 and MiD51 and assembles into spirals that constrict the organelle [22]. ' +
      'Sites of division are frequently marked beforehand by contacts with the endoplasmic reticulum, where actin polymerisation and the transfer of calcium prepare the membrane for constriction [23].',
  },
  {
    kind: 'paragraph',
    text:
      'The balance between these opposing processes determines the morphology of the network. ' +
      'Elongated, highly connected mitochondria are typical of cells that rely on oxidative phosphorylation; they allow the exchange of matrix content and mtDNA between organelles and escape autophagic removal during nutrient starvation [24]. ' +
      'Fragmented mitochondria, in contrast, are favoured during cell division, when the organelles must be distributed evenly between daughter cells, and in cells that depend mainly on glycolysis. ' +
      'Phosphorylation of DRP1 at Ser616 by cyclin B–CDK1 couples fission to entry into mitosis, while phosphorylation at Ser637 by protein kinase A inhibits fission and promotes elongation [25, 26].',
  },
  { kind: 'heading', text: '2.3 Quality control and mitophagy' },
  {
    kind: 'paragraph',
    text:
      'Because mitochondria carry their own genome and are continuously exposed to ROS, they are prone to damage, and cells have evolved several layers of quality control. ' +
      'Misfolded proteins in the matrix are degraded by the proteases LONP1 and CLPP, while damaged proteins of the outer membrane are extracted and delivered to the proteasome [27]. ' +
      'When damage exceeds the capacity of these systems, entire organelles are removed by selective autophagy, a process termed mitophagy.',
  },
  {
    kind: 'paragraph',
    text:
      'The best-characterised mitophagy pathway depends on the kinase PINK1 and the E3 ubiquitin ligase Parkin [28]. ' +
      'In healthy mitochondria PINK1 is imported into the inner membrane and rapidly cleaved by the protease PARL. ' +
      'Loss of membrane potential blocks its import, so PINK1 accumulates on the outer membrane, where it phosphorylates both ubiquitin and Parkin. ' +
      'Activated Parkin decorates outer-membrane proteins with ubiquitin chains that are recognised by autophagy receptors such as optineurin and NDP52, which link the damaged organelle to LC3 on the growing autophagosome [29, 30]. ' +
      'Mutations in *PINK1* and *PRKN* cause early-onset forms of Parkinson’s disease, underscoring the importance of this pathway in long-lived neurons [31]. ' +
      'Receptor-mediated mitophagy through BNIP3, NIX and FUNDC1 operates independently of Parkin and is particularly important during hypoxia and during the maturation of red blood cells [32].',
  },
  { kind: 'heading', text: '2.4 Mitochondria in stem cells' },
  {
    kind: 'paragraph',
    text:
      'Pluripotent stem cells contain relatively few mitochondria with immature, poorly developed cristae and rely largely on glycolysis even when oxygen is abundant [33]. ' +
      'This metabolic profile is thought to limit oxidative damage to the genome and to supply the intermediates for nucleotide, lipid and amino acid synthesis that rapidly dividing cells require. ' +
      'During differentiation, mitochondrial biogenesis increases under the control of the transcriptional coactivator PGC-1α, the network elongates and cells switch towards oxidative phosphorylation [34]. ' +
      'Conversely, reprogramming of somatic cells into induced pluripotent stem cells is accompanied by mitochondrial fragmentation and a shift back to glycolysis, and inhibition of DRP1 reduces reprogramming efficiency [35].',
  },
  {
    kind: 'paragraph',
    text:
      'Metabolites produced by mitochondria also act as cofactors for chromatin-modifying enzymes. ' +
      'α-Ketoglutarate is required by the TET DNA demethylases and by Jumonji-domain histone demethylases, whereas acetyl-CoA supplies the acetyl groups used for histone acetylation [36]. ' +
      'Changes in mitochondrial activity can therefore alter the epigenetic landscape and influence cell fate decisions, providing a direct link between energy metabolism and gene expression. ' +
      'In *Drosophila melanogaster* and *Caenorhabditis elegans*, mild impairment of the respiratory chain even extends lifespan, an effect that depends on signals sent from the mitochondria to the nucleus [37, 38].',
  },
  { kind: 'heading', text: '3 Concluding remarks' },
  {
    kind: 'paragraph',
    text:
      'Taken together, these observations show that mitochondrial function depends on more than the activity of the respiratory chain alone. ' +
      'The shape of the inner membrane, the balance between fusion and fission and the removal of damaged organelles together determine how efficiently a cell can meet its energetic demands. ' +
      'Open questions remain about how cells sense the condition of individual organelles within a connected network, how quality control is coordinated between tissues, ' +
      'and whether targeting mitochondrial dynamics can slow the progression of neurodegenerative and metabolic diseases [39, 40].',
  },
]
